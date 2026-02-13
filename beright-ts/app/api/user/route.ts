/**
 * User API Route
 * GET /api/user - Get user profile and stats
 * POST /api/user - Create or update user
 * PATCH /api/user - Update user settings
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateUserByWallet,
  getOrCreateUserByTelegram,
  linkWalletToUser,
  getUserPredictions,
  getUserAchievements,
  getUserRank,
  updateUserProfile,
  ProfileUpdateInput,
} from '../../../lib/db';
import { getCalibrationStats, listPending } from '../../../skills/calibration';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('wallet');
    const telegramId = searchParams.get('telegram');
    const includeStats = searchParams.get('stats') !== 'false';
    const includePredictions = searchParams.get('predictions') === 'true';
    const includeAchievements = searchParams.get('achievements') === 'true';

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (hasDb) {
      // Get user from database
      let user;
      if (walletAddress) {
        user = await getOrCreateUserByWallet(walletAddress);
      } else if (telegramId) {
        user = await getOrCreateUserByTelegram(telegramId);
      } else {
        return NextResponse.json(
          { error: 'Must provide wallet or telegram parameter' },
          { status: 400 }
        );
      }

      const response: any = {
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          telegramId: user.telegram_id,
          telegramUsername: user.telegram_username,
          displayName: user.display_name || user.username,
          username: user.username,
          avatarUrl: user.avatar_url,
          // Extended profile fields
          email: user.email,
          bio: user.bio,
          twitterHandle: user.twitter_handle,
          discordHandle: user.discord_handle,
          websiteUrl: user.website_url,
          // Timestamps and settings
          createdAt: user.created_at,
          updatedAt: user.updated_at,
          settings: user.settings,
        },
      };

      // Include stats if requested
      if (includeStats) {
        const rank = await getUserRank(user.id);
        const predictions = await getUserPredictions(user.id, { status: 'all' });
        const resolved = predictions.filter(p => p.outcome !== null);
        const brierScores = resolved.map(p => p.brier_score || 0);
        const avgBrier = brierScores.length > 0
          ? brierScores.reduce((a, b) => a + b, 0) / brierScores.length
          : 0;
        const correct = resolved.filter(p => (p.direction === 'YES') === p.outcome);

        response.stats = {
          totalPredictions: predictions.length,
          resolvedPredictions: resolved.length,
          pendingPredictions: predictions.length - resolved.length,
          brierScore: avgBrier,
          accuracy: resolved.length > 0 ? correct.length / resolved.length : 0,
          rank,
        };
      }

      // Include predictions if requested
      if (includePredictions) {
        const predictions = await getUserPredictions(user.id, { limit: 20 });
        response.predictions = predictions;
      }

      // Include achievements if requested
      if (includeAchievements) {
        const achievements = await getUserAchievements(user.id);
        response.achievements = achievements;
      }

      return NextResponse.json(response);
    } else {
      // Use local file-based stats
      const stats = getCalibrationStats();
      const pending = listPending();

      return NextResponse.json({
        user: {
          id: 'local-user',
          displayName: 'Local User',
          createdAt: new Date().toISOString(),
        },
        stats: {
          totalPredictions: stats.totalPredictions,
          resolvedPredictions: stats.resolvedPredictions,
          pendingPredictions: stats.pendingPredictions,
          brierScore: stats.overallBrierScore,
          accuracy: stats.accuracy,
          streak: stats.streak,
          calibrationByBucket: stats.calibrationByBucket,
          performanceByPlatform: stats.performanceByPlatform,
        },
        predictions: includePredictions ? pending : undefined,
        note: 'Local mode - connect to Supabase for full user management',
      });
    }
  } catch (error) {
    console.error('User GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: any = await request.json();
    const { walletAddress, telegramId, telegramUsername } = body;

    if (!walletAddress && !telegramId) {
      return NextResponse.json(
        { error: 'Must provide walletAddress or telegramId' },
        { status: 400 }
      );
    }

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (!hasDb) {
      return NextResponse.json(
        { error: 'User management requires Supabase connection' },
        { status: 503 }
      );
    }

    let user;
    if (walletAddress) {
      user = await getOrCreateUserByWallet(walletAddress);
    } else {
      user = await getOrCreateUserByTelegram(telegramId, telegramUsername);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        walletAddress: user.wallet_address,
        telegramId: user.telegram_id,
        telegramUsername: user.telegram_username,
        displayName: user.display_name,
        createdAt: user.created_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('User POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create user', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: any = await request.json();
    const { userId, walletAddress, username, email, bio, avatarUrl, avatar_url, twitterHandle, twitter_handle, discordHandle, discord_handle, websiteUrl, website_url, settings } = body;

    // Check if we have database configured
    const hasDb = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY;

    if (!hasDb) {
      return NextResponse.json(
        { error: 'User management requires Supabase connection' },
        { status: 503 }
      );
    }

    // Profile update by wallet address (new flow)
    if (walletAddress && !userId) {
      const profileUpdates: ProfileUpdateInput = {};

      if (username !== undefined) profileUpdates.username = username;
      if (email !== undefined) profileUpdates.email = email;
      if (bio !== undefined) profileUpdates.bio = bio;
      if (avatarUrl !== undefined || avatar_url !== undefined) profileUpdates.avatar_url = avatarUrl || avatar_url;
      if (twitterHandle !== undefined || twitter_handle !== undefined) profileUpdates.twitter_handle = twitterHandle || twitter_handle;
      if (discordHandle !== undefined || discord_handle !== undefined) profileUpdates.discord_handle = discordHandle || discord_handle;
      if (websiteUrl !== undefined || website_url !== undefined) profileUpdates.website_url = websiteUrl || website_url;

      const user = await updateUserProfile(walletAddress, profileUpdates);

      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          walletAddress: user.wallet_address,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatar_url,
          bio: user.bio,
          twitterHandle: user.twitter_handle,
          discordHandle: user.discord_handle,
          websiteUrl: user.website_url,
          createdAt: user.created_at,
          updatedAt: user.updated_at,
        },
      });
    }

    // Legacy flow: require userId
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId or walletAddress' },
        { status: 400 }
      );
    }

    // Link wallet if provided (legacy)
    if (walletAddress && userId) {
      const user = await linkWalletToUser(userId, walletAddress);
      return NextResponse.json({
        success: true,
        user,
      });
    }

    // Save settings to local file if no DB configured
    const fsModule = await import('fs');
    const pathModule = await import('path');
    const settingsFile = pathModule.join(process.cwd(), 'memory', 'settings.json');
    let storedSettings: Record<string, any> = {};
    try {
      if (fsModule.existsSync(settingsFile)) {
        storedSettings = JSON.parse(fsModule.readFileSync(settingsFile, 'utf-8'));
      }
    } catch { /* ignore */ }
    storedSettings[userId || 'default'] = { ...storedSettings[userId || 'default'], ...body, updatedAt: new Date().toISOString() };
    fsModule.writeFileSync(settingsFile, JSON.stringify(storedSettings, null, 2));

    return NextResponse.json({
      success: true,
      message: 'Settings saved',
    });
  } catch (error) {
    console.error('User PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update user', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
