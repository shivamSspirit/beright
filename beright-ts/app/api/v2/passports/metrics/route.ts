import { NextRequest } from 'next/server';
import { withAuth } from '../../../../../lib/middleware/auth';
import { PassportService } from '../../../../../lib/passport';
import { passportErrorResponse, publicPassportResponse } from '../../../../../lib/passport/http';
const service = new PassportService();
export const GET = withAuth(async (_request: NextRequest) => {
  try { return publicPassportResponse(await service.metrics(), 300); } catch (error) { return passportErrorResponse(error); }
});
