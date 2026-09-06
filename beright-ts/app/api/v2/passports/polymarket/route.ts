import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '../../../../../lib/middleware/auth';
import {
  PassportService,
  PassportStoreError,
  PolymarketPassportWorker,
  PolymarketProviderError,
  type PolymarketPassportBuild,
} from '../../../../../lib/passport';

const requestSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
}).strict();

export const runtime = 'nodejs';
export const maxDuration = 300;

type CompletedPassportBuild = {
  build: PolymarketPassportBuild;
  passport: Awaited<ReturnType<PassportService['summary']>>;
};

const passportRuntime = globalThis as typeof globalThis & {
  activePolymarketPassportBuilds?: Map<string, Promise<CompletedPassportBuild>>;
};
const activeBuilds = passportRuntime.activePolymarketPassportBuilds
  ?? new Map<string, Promise<CompletedPassportBuild>>();
passportRuntime.activePolymarketPassportBuilds = activeBuilds;

function buildPassportOnce(address: string): Promise<CompletedPassportBuild> {
  const normalizedAddress = address.toLowerCase();
  const activeBuild = activeBuilds.get(normalizedAddress);
  if (activeBuild) return activeBuild;

  const buildPromise = (async () => {
    const build = await new PolymarketPassportWorker().run(normalizedAddress);
    const passport = await new PassportService().summary(build.subject.subjectId);
    return { build, passport };
  })();
  activeBuilds.set(normalizedAddress, buildPromise);
  void buildPromise.finally(() => activeBuilds.delete(normalizedAddress)).catch(() => undefined);
  return buildPromise;
}

export const POST = withAuth(async (request: NextRequest, context) => {
  if (context.rateLimit.remaining <= 0) {
    return NextResponse.json({ error: { code: 'RATE_LIMITED', message: 'Passport build rate limit exceeded' } }, { status: 429 });
  }
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_POLYMARKET_ADDRESS', message: 'A valid Polymarket address is required' } }, { status: 400 });
  }
  try {
    const { build, passport } = await buildPassportOnce(parsed.data.address);
    return NextResponse.json({ schemaVersion: 'reputation-protocol/v1', report: build.report, passport }, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    if (error instanceof PolymarketProviderError) {
      return NextResponse.json({ error: { code: error.retryable ? 'POLYMARKET_UNAVAILABLE' : 'POLYMARKET_IMPORT_REJECTED', message: error.message } }, {
        status: error.retryable ? 503 : 422,
      });
    }
    if (error instanceof PassportStoreError) {
      console.error('[Polymarket Passport Store]', error.code, error.cause);
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: 503 });
    }
    console.error('[Polymarket Passport Worker]', error);
    return NextResponse.json({
      error: {
        code: 'PASSPORT_BUILD_FAILED',
        message: 'The Passport build failed during normalization or verification',
        requestId: context.requestId,
      },
    }, { status: 503 });
  }
});
