import type { CommandHandler } from '../types';
import { registerHandler } from './registry';

interface PassportRedirectResult {
  retired: true;
  message: string;
  path: string;
}

export const calibrationHandler: CommandHandler<PassportRedirectResult> = {
  id: 'calibration',
  skillsUsed: [],
  async execute(context) {
    return {
      success: true,
      data: {
        retired: true,
        message: 'The legacy calibration score is retired. Reputation is now published as a Polymarket Passport topic vector.',
        path: '/leaderboard',
      },
      meta: {
        handlerId: 'calibration',
        routeId: context.route.id,
        executedAt: new Date(),
        durationMs: 0,
        skillsUsed: [],
        apiCallsMade: 0,
      },
      hints: { mood: 'NEUTRAL', suggestedActions: ['/leaderboard'] },
    };
  },
};

registerHandler(calibrationHandler);
export default calibrationHandler;
