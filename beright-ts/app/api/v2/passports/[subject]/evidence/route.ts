import { NextRequest } from 'next/server';
import { withAuth } from '../../../../../../lib/middleware/auth';
import { PassportService } from '../../../../../../lib/passport';
import { passportErrorResponse, passportLookup, publicPassportResponse } from '../../../../../../lib/passport/http';
const service = new PassportService();
export const GET = withAuth(async (request: NextRequest) => {
  try { return publicPassportResponse(await service.evidence(passportLookup(request)), 30); } catch (error) { return passportErrorResponse(error); }
});
