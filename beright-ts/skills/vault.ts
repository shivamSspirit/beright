/**
 * Vault v0 — Telegram Signal Channel Commands
 *
 * Commands:
 *   /create-channel [name]   — Create a new signal channel
 *   /channel                 — View your channel stats
 *   /signal [YES/NO] [market] [probability] [reasoning]  — Broadcast a signal
 *   /channels                — Browse top forecaster channels
 *   /subscribe-channel [slug] — Subscribe to a channel
 *   /unsubscribe-channel [slug] — Unsubscribe from a channel
 *   /my-channels             — List channels you subscribe to
 *
 * On-chain vault:
 *   /my-vault                — View your on-chain BeRight vault status
 */

import {
  createChannel,
  getChannelByForecaster,
  getChannelBySlug,
  getTopChannels,
  subscribeToChannel,
  unsubscribeFromChannel,
  getSubscriberChannels,
  getChannelSubscribers,
  broadcastSignal,
  getChannelSignals,
  formatChannelCard,
  formatSignalBroadcast,
} from '../lib/channels/client';
import type { ChannelTier } from '../lib/channels/types';
import { getUserByTelegram } from '../lib/identity';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { VAULT_PROGRAM_ID, VAULT_RPC as VAULT_RPC_MAP, deriveVaultPda, deriveVaultStatePda, VaultIDL } from '../lib/onchain-vault/index';

const VAULT_RPC = process.env.SOLANA_RPC_URL || VAULT_RPC_MAP.devnet;

type Sender = (chatId: number, text: string, options?: Record<string, unknown>) => Promise<void>;

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export async function handleVaultCommand(
  command: string,
  args: string[],
  telegramId: number,
  displayName: string,
  send: Sender
): Promise<boolean> {
  switch (command) {
    case '/create-channel':
      return handleCreateChannel(args, telegramId, displayName, send);
    case '/channel':
      return handleMyChannel(telegramId, send);
    case '/signal':
      return handleBroadcastSignal(args, telegramId, send);
    case '/channels':
      return handleBrowseChannels(args, telegramId, send);
    case '/subscribe-channel':
      return handleSubscribeChannel(args, telegramId, send);
    case '/unsubscribe-channel':
      return handleUnsubscribeChannel(args, telegramId, send);
    case '/my-channels':
      return handleMySubscriptions(telegramId, send);
    case '/my-vault':
      return handleMyVaultOnchain(telegramId, send);
    default:
      return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE CHANNEL
// ─────────────────────────────────────────────────────────────────────────────

async function handleCreateChannel(
  args: string[],
  telegramId: number,
  displayName: string,
  send: Sender
): Promise<boolean> {
  // Check if already has a channel
  const existing = await getChannelByForecaster(telegramId);
  if (existing) {
    await send(telegramId, [
      `📡 You already have a channel: *${existing.name}*`,
      ``,
      `📊 ${existing.signal_count} signals · ${existing.subscriber_count} subscribers`,
      ``,
      `Use /signal to broadcast a new prediction to your subscribers.`,
    ].join('\n'), { parse_mode: 'Markdown' });
    return true;
  }

  if (args.length === 0) {
    await send(telegramId, [
      `📡 *Create Your Signal Channel*`,
      ``,
      `Share your predictions and build a following.`,
      `Subscribers get Telegram alerts when you call a market.`,
      ``,
      `Usage: /create-channel [name]`,
      `Example: /create-channel Alpha Macro Signals`,
      ``,
      `Tiers:`,
      `  Free — unlimited subscribers, no charge`,
      `  Pro ($29/mo) — premium label, priority delivery`,
      `  Whale ($99/mo) — verified badge, featured placement`,
    ].join('\n'), { parse_mode: 'Markdown' });
    return true;
  }

  const name = args.join(' ').trim().slice(0, 60);
  const tier: ChannelTier = 'free'; // Start all channels on free tier

  await send(telegramId, `Creating channel "_${name}_"...`, { parse_mode: 'Markdown' });

  const channel = await createChannel({
    forecasterTelegramId: telegramId,
    forecasterDisplayName: displayName,
    name,
    description: `Signal channel by ${displayName}`,
    tier,
  });

  if (!channel) {
    await send(telegramId, '❌ Failed to create channel. Try again in a moment.');
    return true;
  }

  await send(telegramId, [
    `✅ *Channel created!*`,
    ``,
    `📡 *${channel.name}*`,
    `🔗 slug: \`${channel.slug}\``,
    ``,
    `Next steps:`,
    `1. Broadcast your first signal: /signal YES "Will X happen?" 0.75 high "My reasoning here"`,
    `2. Share your channel: others can subscribe with /subscribe-channel ${channel.slug}`,
    ``,
    `_Every signal is timestamped on Solana — your track record is public and verifiable._`,
  ].join('\n'), { parse_mode: 'Markdown' });

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// VIEW MY CHANNEL
// ─────────────────────────────────────────────────────────────────────────────

async function handleMyChannel(telegramId: number, send: Sender): Promise<boolean> {
  const channel = await getChannelByForecaster(telegramId);

  if (!channel) {
    await send(telegramId, [
      `📡 You don't have a signal channel yet.`,
      ``,
      `Create one: /create-channel [name]`,
    ].join('\n'));
    return true;
  }

  const recentSignals = await getChannelSignals(channel.id, 5);
  const pending = recentSignals.filter(s => !s.resolved_at).length;
  const resolved = recentSignals.filter(s => s.resolved_at !== null).length;

  const lines = [
    `📡 *${channel.name}* ${channel.is_verified ? '✓' : ''}`,
    ``,
    `👥 Subscribers: ${channel.subscriber_count}`,
    `📊 Total signals: ${channel.signal_count}`,
    `📅 Last 7 days: ${channel.signals_7d} signals`,
    channel.win_rate != null ? `🎯 Win rate: ${Math.round(channel.win_rate * 100)}%` : '',
    ``,
    `Recent signals:`,
  ];

  if (recentSignals.length === 0) {
    lines.push('  No signals yet. Use /signal to broadcast.');
  } else {
    recentSignals.slice(0, 3).forEach(s => {
      const status = s.resolved_at
        ? (s.outcome ? '✅' : '❌')
        : '⏳';
      lines.push(`  ${status} ${s.direction} — ${s.market_title.slice(0, 40)}`);
    });
  }

  lines.push('');
  lines.push('Broadcast a new signal: /signal YES "market question" 0.80 high "reasoning"');

  await send(telegramId, lines.filter(l => l !== undefined).join('\n'), { parse_mode: 'Markdown' });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// BROADCAST SIGNAL
// ─────────────────────────────────────────────────────────────────────────────

async function handleBroadcastSignal(
  args: string[],
  telegramId: number,
  send: Sender,
): Promise<boolean> {
  // Usage: /signal YES "Will Trump win?" 0.75 high "Strong polling data"
  // Args: [direction, market_title, probability, confidence?, ...reasoning]
  if (args.length < 3) {
    await send(telegramId, [
      `📡 *Broadcast a Signal*`,
      ``,
      `Usage: /signal [YES/NO] "[market]" [probability] [confidence] [reasoning]`,
      ``,
      `Example:`,
      `/signal YES "Will BTC hit 100k?" 0.65 medium "Strong ETF inflows + halving cycle"`,
      ``,
      `Probability: 0.01–0.99 (your forecast of the outcome being correct)`,
      `Confidence: low | medium | high`,
    ].join('\n'), { parse_mode: 'Markdown' });
    return true;
  }

  // Check forecaster has a channel
  const channel = await getChannelByForecaster(telegramId);
  if (!channel) {
    await send(telegramId, [
      `❌ You need a channel to broadcast signals.`,
      `Create one first: /create-channel [name]`,
    ].join('\n'));
    return true;
  }

  const direction = args[0].toUpperCase() as 'YES' | 'NO';
  if (direction !== 'YES' && direction !== 'NO') {
    await send(telegramId, `❌ Direction must be YES or NO. Got: ${args[0]}`);
    return true;
  }

  // Parse probability
  const probArg = parseFloat(args[args.length - 1]) || parseFloat(args[2]);
  const probability = Math.min(0.99, Math.max(0.01, isNaN(probArg) ? 0.7 : probArg));

  // Detect confidence word in args
  const confWords = ['low', 'medium', 'high'];
  const confArg = args.find(a => confWords.includes(a.toLowerCase())) || 'medium';
  const confidence = confArg as 'low' | 'medium' | 'high';

  // Market title: everything between direction and probability/confidence
  const skipWords = new Set([direction.toLowerCase(), confArg.toLowerCase(), String(probability), String(probArg)]);
  const marketParts = args.slice(1).filter(a => !skipWords.has(a.toLowerCase()) && isNaN(parseFloat(a)));
  const marketTitle = marketParts.slice(0, 8).join(' ').replace(/^["']|["']$/g, '').trim() || 'Unknown market';

  // Reasoning: rest of args that aren't parsed
  const allText = args.slice(1).join(' ');
  const reasoning = allText.length > 10 ? allText : `${direction} with ${Math.round(probability * 100)}% confidence`;

  await send(telegramId, `⏳ Broadcasting signal to ${channel.subscriber_count} subscribers...`);

  const { signal, commitTx } = await broadcastSignal({
    channelId: channel.id,
    forecasterTelegramId: telegramId,
    marketTitle,
    platform: 'kalshi',
    direction,
    probability,
    confidence,
    reasoning,
    timeHorizon: '7d',
  });

  if (!signal) {
    await send(telegramId, '❌ Failed to broadcast signal. Try again.');
    return true;
  }

  // Notify all subscribers
  const subscribers = await getChannelSubscribers(channel.id);
  const message = formatSignalBroadcast(signal, channel.name);

  let notifiedCount = 0;
  for (const sub of subscribers) {
    if (sub.notify_telegram && sub.subscriber_telegram_id !== telegramId) {
      try {
        await send(sub.subscriber_telegram_id, message, { parse_mode: 'Markdown' });
        notifiedCount++;
      } catch (e) {
        // Subscriber may have blocked bot
      }
    }
  }

  // Update notified_count
  if (notifiedCount > 0) {
    // Fire-and-forget
  }

  const chainLine = commitTx
    ? `🔗 [On-chain proof](https://solscan.io/tx/${commitTx})`
    : '⚠️ On-chain commit failed (non-fatal)';

  await send(telegramId, [
    `✅ *Signal broadcast!*`,
    ``,
    `📣 ${notifiedCount} subscribers notified`,
    `🎯 ${direction} ${marketTitle}`,
    `📊 Forecast: ${Math.round(probability * 100)}%`,
    ``,
    chainLine,
  ].join('\n'), { parse_mode: 'Markdown' });

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// BROWSE CHANNELS
// ─────────────────────────────────────────────────────────────────────────────

async function handleBrowseChannels(
  args: string[],
  telegramId: number,
  send: Sender
): Promise<boolean> {
  const channels = await getTopChannels(8);

  if (channels.length === 0) {
    await send(telegramId, [
      `📡 *Forecaster Signal Channels*`,
      ``,
      `No channels yet. Be the first!`,
      `Create: /create-channel [name]`,
    ].join('\n'), { parse_mode: 'Markdown' });
    return true;
  }

  const lines = [`📡 *Top Signal Channels*\n`];

  channels.forEach((ch, i) => {
    const verBadge = ch.is_verified ? ' ✓' : '';
    const winStr = ch.win_rate != null ? ` · ${Math.round(ch.win_rate * 100)}% wins` : '';
    const tierStr = ch.tier !== 'free' ? ` · ${ch.tier.toUpperCase()}` : '';
    lines.push(`${i + 1}. *${ch.name}*${verBadge}${tierStr}`);
    lines.push(`   👥 ${ch.subscriber_count} subs · 📊 ${ch.signal_count} signals${winStr}`);
    lines.push(`   /subscribe-channel ${ch.slug}`);
    lines.push('');
  });

  lines.push(`Create your channel: /create-channel [name]`);

  await send(telegramId, lines.join('\n'), { parse_mode: 'Markdown' });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUBSCRIBE / UNSUBSCRIBE
// ─────────────────────────────────────────────────────────────────────────────

async function handleSubscribeChannel(
  args: string[],
  telegramId: number,
  send: Sender
): Promise<boolean> {
  if (args.length === 0) {
    await send(telegramId, [
      `Usage: /subscribe-channel [slug]`,
      `Browse channels: /channels`,
    ].join('\n'));
    return true;
  }

  const slug = args[0].toLowerCase();
  const channel = await getChannelBySlug(slug);

  if (!channel) {
    await send(telegramId, `❌ Channel not found: ${slug}\n\nBrowse channels: /channels`);
    return true;
  }

  if (channel.forecaster_telegram_id === telegramId) {
    await send(telegramId, `❌ You can't subscribe to your own channel.`);
    return true;
  }

  const { success, message } = await subscribeToChannel(channel.id, telegramId);

  if (!success) {
    await send(telegramId, `❌ ${message}`);
    return true;
  }

  await send(telegramId, [
    `✅ *Subscribed to ${channel.name}*`,
    ``,
    `You'll receive Telegram alerts when ${channel.forecaster_display_name} broadcasts a signal.`,
    ``,
    `Unsubscribe anytime: /unsubscribe-channel ${channel.slug}`,
  ].join('\n'), { parse_mode: 'Markdown' });

  return true;
}

async function handleUnsubscribeChannel(
  args: string[],
  telegramId: number,
  send: Sender
): Promise<boolean> {
  if (args.length === 0) {
    await send(telegramId, `Usage: /unsubscribe-channel [slug]\nView subscriptions: /my-channels`);
    return true;
  }

  const slug = args[0].toLowerCase();
  const channel = await getChannelBySlug(slug);

  if (!channel) {
    await send(telegramId, `❌ Channel not found: ${slug}`);
    return true;
  }

  await unsubscribeFromChannel(channel.id, telegramId);

  await send(telegramId, `✅ Unsubscribed from *${channel.name}*.`, { parse_mode: 'Markdown' });
  return true;
}

async function handleMySubscriptions(telegramId: number, send: Sender): Promise<boolean> {
  const subs = await getSubscriberChannels(telegramId);

  if (subs.length === 0) {
    await send(telegramId, [
      `📡 You're not subscribed to any signal channels.`,
      ``,
      `Browse channels: /channels`,
    ].join('\n'));
    return true;
  }

  const lines = [`📡 *Your Signal Channels* (${subs.length})\n`];

  subs.forEach(sub => {
    const ch = (sub as any).channel as import('../lib/channels/types').SignalChannel;
    if (!ch) return;
    const winStr = ch.win_rate != null ? ` · ${Math.round(ch.win_rate * 100)}% wins` : '';
    lines.push(`📡 *${ch.name}* ${ch.is_verified ? '✓' : ''}`);
    lines.push(`   ${ch.signal_count} signals · ${ch.subscriber_count} subs${winStr}`);
    lines.push(`   Unsubscribe: /unsubscribe-channel ${ch.slug}`);
    lines.push('');
  });

  await send(telegramId, lines.join('\n'), { parse_mode: 'Markdown' });
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ON-CHAIN VAULT STATUS
// ─────────────────────────────────────────────────────────────────────────────

async function handleMyVaultOnchain(telegramId: number, send: Sender): Promise<boolean> {
  const user = getUserByTelegram(String(telegramId));

  if (!user?.walletAddress) {
    await send(telegramId, [
      `🔐 *BeRight Vault*`,
      ``,
      `No wallet linked to your account.`,
      ``,
      `Connect your Solana wallet first:`,
      `/connect <your-wallet-address>`,
      ``,
      `Then visit the vault dashboard:`,
      `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://beright.app'}/vault`,
    ].join('\n'), { parse_mode: 'Markdown' });
    return true;
  }

  await send(telegramId, `🔍 Reading vault from chain...`);

  try {
    const owner = new PublicKey(user.walletAddress);
    const connection = new Connection(VAULT_RPC, 'confirmed');

    // Read-only provider — no signing
    const provider = new AnchorProvider(
      connection,
      { publicKey: owner, signTransaction: async (t: unknown) => t as never, signAllTransactions: async (t: unknown) => t as never },
      { commitment: 'confirmed' },
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const program = new Program(VaultIDL as any, provider);

    const [vaultStatePda] = deriveVaultStatePda(owner);
    const [vaultPda]      = deriveVaultPda(owner);

    let raw: Record<string, unknown>;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      raw = await (program.account as any).vaultState.fetch(vaultStatePda);
    } catch {
      await send(telegramId, [
        `🔐 *BeRight Vault*`,
        ``,
        `No vault found for wallet \`${user.walletAddress.slice(0, 8)}…\``,
        ``,
        `Initialize yours at:`,
        `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://beright.app'}/vault`,
      ].join('\n'), { parse_mode: 'Markdown' });
      return true;
    }

    const vaultLamports  = await connection.getBalance(vaultPda);
    const vaultSol       = vaultLamports / LAMPORTS_PER_SOL;
    const now            = Math.floor(Date.now() / 1000);
    const lockUntil      = (raw.lockUntil as BN).toNumber();
    const timelocked     = lockUntil > now;
    const isFrozen       = raw.isFrozen as boolean;
    const guardianSet    = raw.guardianSet as boolean;
    const epochLimit     = (raw.epochWithdrawLimit as BN).toNumber();
    const epochWithdrawn = (raw.epochWithdrawn as BN).toNumber();

    const statusEmoji = isFrozen ? '🔴' : timelocked ? '🟡' : '🟢';
    const statusText  = isFrozen ? 'FROZEN' : timelocked ? 'TIMELOCKED' : 'ACTIVE';

    function fmtSol(lamps: number) {
      return (lamps / LAMPORTS_PER_SOL).toFixed(4);
    }
    function fmtTime(secs: number) {
      const d = Math.floor(secs / 86400);
      const h = Math.floor((secs % 86400) / 3600);
      if (d > 0) return `${d}d ${h}h`;
      const m = Math.floor((secs % 3600) / 60);
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    }

    const lines = [
      `🔐 *BeRight Vault*`,
      ``,
      `${statusEmoji} Status: *${statusText}*`,
      `💰 Balance: *${vaultSol.toFixed(4)} SOL*`,
      ``,
      `📥 Deposited: ${fmtSol((raw.totalDeposited as BN).toNumber())} SOL`,
      `📤 Withdrawn: ${fmtSol((raw.totalWithdrawn as BN).toNumber())} SOL`,
    ];

    if (timelocked) {
      lines.push(`⏳ Unlocks in: ${fmtTime(lockUntil - now)}`);
    }

    if (epochLimit < Number.MAX_SAFE_INTEGER && epochLimit > 0) {
      const pct = Math.round((epochWithdrawn / epochLimit) * 100);
      lines.push(`📊 Epoch limit: ${fmtSol(epochWithdrawn)}/${fmtSol(epochLimit)} SOL (${pct}% used)`);
    }

    if (guardianSet) {
      const threshold = (raw.largeWithdrawThreshold as BN).toNumber();
      lines.push(`🛡 Guardian: active (required for ≥${fmtSol(threshold)} SOL)`);
    }

    lines.push(``);
    lines.push(`Wallet: \`${user.walletAddress.slice(0, 8)}…${user.walletAddress.slice(-4)}\``);
    lines.push(`[Manage vault](${process.env.NEXT_PUBLIC_APP_URL ?? 'https://beright.app'}/vault)`);

    await send(telegramId, lines.join('\n'), { parse_mode: 'Markdown' });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await send(telegramId, `❌ Failed to read vault: ${msg.slice(0, 120)}`);
  }

  return true;
}
