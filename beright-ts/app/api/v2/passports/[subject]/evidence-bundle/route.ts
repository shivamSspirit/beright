import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../lib/middleware/auth';
import { PassportService } from '../../../../../../lib/passport';
import { passportErrorResponse, passportLookup } from '../../../../../../lib/passport/http';
const service = new PassportService();
export const GET = withAuth(async (request: NextRequest) => {
  const lookup = passportLookup(request);
  try {
    const bundle = await service.evidenceBundle(lookup);
    const filename = `beright-evidence-${bundle.subject.subjectId.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
    return new NextResponse(JSON.stringify(bundle), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'private, max-age=0, must-revalidate' } });
  } catch (error) { return passportErrorResponse(error); }
});
