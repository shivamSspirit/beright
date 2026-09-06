import 'dotenv/config';
import { PassportStoreError, PolymarketPassportWorker } from '../lib/passport';

function databaseErrorDetails(error: unknown): string | null {
  if (!(error instanceof PassportStoreError) || !error.cause) return null;
  if (error.cause instanceof Error) return error.cause.message;
  if (typeof error.cause !== 'object') return String(error.cause);
  const cause = error.cause as Record<string, unknown>;
  return ['code', 'message', 'details', 'hint']
    .flatMap((key) => typeof cause[key] === 'string' && cause[key] ? [`${key}: ${cause[key]}`] : [])
    .join('; ') || null;
}

async function main(): Promise<void> {
  const address = process.argv[2];
  if (!address) throw new Error('Usage: npm run passport:polymarket -- 0xYourPolymarketAddress');
  const build = await new PolymarketPassportWorker().run(address);
  process.stdout.write(`${JSON.stringify({ subjectId: build.subject.subjectId, passportRoot: build.bundle.passportRoot, report: build.report }, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const details = databaseErrorDetails(error);
  process.stderr.write(`${message}${details ? ` (${details})` : ''}\n`);
  process.exitCode = 1;
});
