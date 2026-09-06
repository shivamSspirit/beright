import type { CommandHandler } from '../types';
import { registerHandler } from './registry';

interface PassportRedirectResult {
  retired: true;
  message: string;
  path: string;
}

export const leaderboardHandler: CommandHandler<PassportRedirectResult> = {
  id: 'leaderboard',
  skillsUsed: [],
  async execute(context) {
    return {
      success: true,
      data: {
        retired: true,
        message: 'Universal forecaster rankings are retired. Build or inspect a topic-specific Polymarket Passport.',
        path: '/leaderboard',
      },
      meta: {
        handlerId: 'leaderboard',
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

registerHandler(leaderboardHandler);
export default leaderboardHandler;
