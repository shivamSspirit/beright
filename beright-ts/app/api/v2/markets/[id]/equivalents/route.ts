import { NextRequest } from 'next/server';
import { withAuth } from '../../../../../../lib/middleware/auth';
import { PassportService } from '../../../../../../lib/passport';
import { passportErrorResponse, publicPassportResponse } from '../../../../../../lib/passport/http';

const service = new PassportService();

export const GET = withAuth(async (request: NextRequest) => {
    const parts = request.nextUrl.pathname.split('/').filter(Boolean);
    const index = parts.indexOf('markets');

    try {
        return publicPassportResponse(
            await service.equivalents(decodeURIComponent(parts[index + 1] ?? ''))
        );
    } catch (error) {
        return passportErrorResponse(error);
    }
});
