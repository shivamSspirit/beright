/**
 * User Identity System for BeRight Protocol
 * Links Telegram users to Solana wallets
 */

import * as fs from 'fs';
import * as path from 'path';

const MEMORY_DIR = path.join(process.cwd(), 'memory');
const USERS_FILE = path.join(MEMORY_DIR, 'users.json');

// User identity structure
export interface UserIdentity {
  id: string;                    // Internal ID
  telegramId?: string;           // Telegram user ID
  telegramUsername?: string;     // @username
  discordId?: string;            // Discord user ID
  walletAddress?: string;        // Solana wallet (primary)
  walletAddresses?: string[];    // Additional wallets
  createdAt: string;
  lastSeen: string;
  settings: {
    alerts: boolean;             // Receive alerts
    briefTime?: string;          // Preferred brief time (e.g., "08:00")
    timezone?: string;           // User timezone
  };
  stats: {
    totalPredictions: number;
    totalTrades: number;
    volumeUsd: number;
  };
}

// Load users from file
function loadUsers(): Record<string, UserIdentity> {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Error loading users:', error);
  }
  return {};
}

// Save users to file
function saveUsers(users: Record<string, UserIdentity>): void {
  try {
    if (!fs.existsSync(MEMORY_DIR)) {
      fs.mkdirSync(MEMORY_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error saving users:', error);
  }
}

/**
 * Get or create user by Telegram ID
 */
export function getOrCreateUser(telegramId: string, username?: string): UserIdentity {
  const users = loadUsers();

  // Find existing user by Telegram ID
  let user = Object.values(users).find(u => u.telegramId === telegramId);

  if (!user) {
    // Create new user
    const id = `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    user = {
      id,
      telegramId,
      telegramUsername: username,
      createdAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      settings: {
        alerts: true,
      },
      stats: {
        totalPredictions: 0,
        totalTrades: 0,
        volumeUsd: 0,
      },
    };
    users[id] = user;
    saveUsers(users);
    console.log(`Created new user: ${id} (Telegram: ${telegramId})`);
  } else {
    // Update last seen
    user.lastSeen = new Date().toISOString();
    if (username && !user.telegramUsername) {
      user.telegramUsername = username;
    }
    users[user.id] = user;
    saveUsers(users);
  }

  return user;
}

/**
 * Link wallet to user
 */
export function linkWallet(telegramId: string, walletAddress: string): UserIdentity | null {
  const users = loadUsers();
  const user = Object.values(users).find(u => u.telegramId === telegramId);

  if (!user) {
    return null;
  }

  // Validate Solana address (basic check)
  if (walletAddress.length < 32 || walletAddress.length > 44) {
    throw new Error('Invalid Solana wallet address');
  }

  // Set as primary wallet
  if (!user.walletAddress) {
    user.walletAddress = walletAddress;
  }

  // Add to addresses list
  if (!user.walletAddresses) {
    user.walletAddresses = [];
  }
  if (!user.walletAddresses.includes(walletAddress)) {
    user.walletAddresses.push(walletAddress);
  }

  users[user.id] = user;
  saveUsers(users);

  console.log(`Linked wallet ${walletAddress.slice(0, 8)}... to user ${user.id}`);
  return user;
}

/**
 * Get user by Telegram ID
 */
export function getUserByTelegram(telegramId: string): UserIdentity | null {
  const users = loadUsers();
  return Object.values(users).find(u => u.telegramId === telegramId) || null;
}

/**
 * Get user by wallet address
 */
export function getUserByWallet(walletAddress: string): UserIdentity | null {
  const users = loadUsers();
  return Object.values(users).find(
    u => u.walletAddress === walletAddress || u.walletAddresses?.includes(walletAddress)
  ) || null;
}

/**
 * Update user stats
 */
export function updateUserStats(
  telegramId: string,
  update: Partial<UserIdentity['stats']>
): UserIdentity | null {
  const users = loadUsers();
  const user = Object.values(users).find(u => u.telegramId === telegramId);

  if (!user) return null;

  user.stats = { ...user.stats, ...update };
  users[user.id] = user;
  saveUsers(users);

  return user;
}

/**
 * Update user settings
 */
export function updateUserSettings(
  telegramId: string,
  settings: Partial<UserIdentity['settings']>
): UserIdentity | null {
  const users = loadUsers();
  const user = Object.values(users).find(u => u.telegramId === telegramId);

  if (!user) return null;

  user.settings = { ...user.settings, ...settings };
  users[user.id] = user;
  saveUsers(users);

  return user;
}

/**
 * Get all users (for leaderboard, etc.)
 */
export function getAllUsers(): UserIdentity[] {
  const users = loadUsers();
  return Object.values(users);
}

/**
 * Get user count
 */
export function getUserCount(): number {
  const users = loadUsers();
  return Object.keys(users).length;
}
