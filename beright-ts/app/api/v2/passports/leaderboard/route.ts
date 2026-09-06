import { NextRequest } from 'next/server';
import { withAuth } from '../../../../../lib/middleware/auth';
import { PassportService } from '../../../../../lib/passport';
import { passportErrorResponse, publicPassportResponse } from '../../../../../lib/passport/http';

const LAUNCH_WALLETS = [
  '0x73e3fec494611d73c170cb2f23850fd998b21be9',
  '0x8a8685a792c184e5c2ee8c7d4d4baba7c2c94998',
  '0x709e8dcb133555794decc598e07f2c923b8366f5',
  '0x821dab0565ebf5b327f51db06223fdcfe01acf16',
  '0xfe787d2da716d60e8acff57fb87eb13cd4d10319',
] as const;

const service = new PassportService();

export const GET = withAuth(async (_request: NextRequest) => {
  try {
    return publicPassportResponse(await service.leaderboard([...LAUNCH_WALLETS]), 30);
  } catch (error) {
    return passportErrorResponse(error);
  }
});
