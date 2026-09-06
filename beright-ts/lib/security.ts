/**
 * Security Layer for BeRight Telegram Bot
 *
 * Implements:
 * 1. User tier system (public, verified, admin)
 * 2. Command allowlists per tier
 * 3. Input sanitization (prompt injection protection)
 * 4. Output filtering (secret scrubbing)
 * 5. Rate limiting
 * 6. Audit logging
 */

// ============================================
// USER TIERS (Simple 3-tier system)
// ============================================
//
// super_admin → You only (can use /build, /improve, /memory)
// verified    → Predictions + trading + wallet (auto-verified on first prediction)
// public      → Basic commands only
//

export type UserTier = 'public' | 'verified' | 'super_admin';

export interface UserSecurityProfile {
  telegramId: string;
  tier: UserTier;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerHour: number;
  };
  lastRequestTime?: number;
  requestCount: {
    minute: number;
    hour: number;
    minuteReset: number;
    hourReset: number;
  };
}

// Super admin - ONLY this ID can use /build, /improve, /memory, etc.
const SUPER_ADMIN_ID = process.env.SUPER_ADMIN_TELEGRAM_ID || '5504043269';

// Pre-verified users (optional - users auto-verify on first prediction)
const VERIFIED_IDS: string[] = process.env.VERIFIED_TELEGRAM_IDS?.split(',').filter(Boolean) || [];

// In-memory verified users (auto-verified when they make first prediction)
const dynamicVerifiedUsers = new Set<string>();

// ============================================
// COMMAND ALLOWLISTS (Simplified 3-tier)
// ============================================

// PUBLIC: Basic discovery commands (no account needed)
// Note: /predict is public to allow easy onboarding - predictions require wallet anyway
export const PUBLIC_COMMANDS: string[] = [
  '/start',
  '/help',
  '/hot',
  '/brief',
  '/odds',
  '/arb',
  '/news',
  '/social',
  '/intel',
  '/research',
  '/leaderboard',
  '/predict',       // Public for easy onboarding
  '/smartpredict',  // Public for easy onboarding
  '/findmarket',    // Public for discovery
  '/me',            // Public to show stats
];

// VERIFIED: Predictions + Trading + Wallet (auto-verified on first prediction)
export const VERIFIED_COMMANDS: string[] = [
  ...PUBLIC_COMMANDS,
  // Predictions
  '/predict',
  '/me',
  '/calibration',
  '/feedback',
  '/recommend',
  '/compare',
  '/learnings',
  '/smartpredict',
  '/findmarket',
  '/intelligence',
  '/analyze',
  // Identity
  '/connect',
  '/profile',
  // Notifications
  '/subscribe',
  '/unsubscribe',
  '/alerts',
  '/follow',
  '/unfollow',
  '/signals',
  '/toplists',
  // Portfolio
  '/portfolio',
  '/pnl',
  '/expiring',
  '/alert',
  // Trading (available to verified users)
  '/wallet',
  '/mywallet',
  '/dflow',
  '/trade',
  '/positions',
  '/mypositions',
  '/buy',
  '/swap',
  '/execute',
  '/scan',
  '/volume',
  '/lp',
  '/balance',
  // Kalshi trading
  '/kalshi',
  '/kbalance',
  '/kpositions',
  '/kmarkets',
  '/kbuy',
  '/ksell',
  // Whale tracking
  '/whale',
  '/track_whale',
  // Auto-trading rules
  '/limits',
  '/autobet',
  '/stoploss',
  '/takeprofit',
  '/dca',
];

// SUPER ADMIN ONLY: Dangerous commands (only you - 5504043269)
const SUPER_ADMIN_COMMANDS: string[] = [
  // Builder commands
  '/build',
  '/improve',
  '/refactor',
  '/devtest',
  '/status',
  // Memory/system commands
  '/memory',
  '/recall',
  // Gateway/Monitor control (CRITICAL - can stop services)
  '/arb-monitor',
  '/gateway',
  '/shutdown',
  '/stop',
  '/restart',
];

// ============================================
// BANNED PATTERNS (Prompt Injection Protection)
// ============================================

const BANNED_PATTERNS: RegExp[] = [
  // System prompt extraction attempts
  /ignore\s+(previous|all|above)\s+instructions/i,
  /what\s+are\s+your\s+(instructions|rules|system\s+prompt)/i,
  /reveal\s+(your|the)\s+(system|prompt|instructions)/i,
  /output\s+(your|the)\s+(system|prompt)/i,
  /print\s+(your|the)\s+prompt/i,
  /show\s+me\s+(your|the)\s+(rules|instructions)/i,

  // Data extraction attempts
  /give\s+me\s+all\s+(users?|data|messages|conversations)/i,
  /list\s+all\s+(users?|api\s*keys?|secrets?)/i,
  /show\s+(api|secret)\s*key/i,
  /what\s+(api|secret)\s*keys?\s+do\s+you\s+have/i,
  /env\s+variables?/i,
  /\.env\s+file/i,
  /process\.env/i,

  // Code execution attempts
  /execute\s+(this\s+)?code/i,
  /run\s+(this\s+)?script/i,
  /eval\(/i,
  /exec\(/i,
  /import\s+os/i,
  /require\s*\(\s*['"]child_process/i,

  // Build/modification attempts (unless admin)
  /build\s+(something|a|an|the)/i,
  /create\s+(a\s+)?file/i,
  /modify\s+(the\s+)?code/i,
  /change\s+(the\s+)?source/i,
  /edit\s+(the\s+)?codebase/i,
  /push\s+to\s+(git|github|repo)/i,
  /commit\s+(the\s+)?changes/i,

  // Role/persona manipulation
  /you\s+are\s+now/i,
  /act\s+as\s+if/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /roleplay\s+as/i,
  /from\s+now\s+on/i,
  /new\s+instructions/i,

  // ============================================
  // AWS/CLOUD DESTRUCTION (CRITICAL)
  // ============================================
  /aws\s+ec2\s+terminate/i,
  /aws\s+ec2\s+delete/i,
  /aws\s+ec2\s+stop-instances/i,
  /aws\s+s3\s+rb/i,                    // bucket delete
  /aws\s+s3\s+rm\s+.*--recursive/i,
  /aws\s+rds\s+delete/i,
  /aws\s+lambda\s+delete/i,
  /aws\s+iam\s+delete/i,
  /aws\s+cloudformation\s+delete/i,
  /aws\s+ecs\s+delete/i,
  /aws\s+eks\s+delete/i,
  /terraform\s+destroy/i,
  /pulumi\s+destroy/i,
  /kubectl\s+delete/i,
  /docker\s+rm\s+-f/i,
  /docker\s+system\s+prune/i,
  /docker\s+container\s+rm/i,

  // ============================================
  // SYSTEM DESTRUCTION
  // ============================================
  /rm\s+-rf\s+\//i,                    // recursive delete root
  /rm\s+-rf\s+~\//i,                   // recursive delete home
  /rm\s+-rf\s+\*/i,                    // recursive delete all
  /rm\s+-rf\s+\.\//i,                  // recursive delete cwd
  /:(){ :\|:& };:/,                    // fork bomb
  /mkfs\./i,                           // format filesystem
  /dd\s+if=.*of=\/dev/i,               // disk overwrite
  />\s*\/dev\/sda/i,                   // overwrite disk
  /shred\s+/i,                         // secure delete

  // ============================================
  // PROCESS/SERVICE CONTROL
  // ============================================
  /kill\s+-9\s+-1/i,                   // kill all processes
  /killall\s+/i,
  /pkill\s+-9/i,
  /shutdown\s+/i,
  /reboot/i,
  /init\s+0/i,
  /init\s+6/i,
  /systemctl\s+stop/i,
  /systemctl\s+disable/i,
  /service\s+.*\s+stop/i,
  /pm2\s+stop\s+all/i,
  /pm2\s+delete\s+all/i,

  // ============================================
  // CREDENTIAL THEFT
  // ============================================
  /cat\s+.*\.env/i,
  /cat\s+.*credentials/i,
  /cat\s+.*\.aws/i,
  /cat\s+.*\.ssh/i,
  /cat\s+\/etc\/passwd/i,
  /cat\s+\/etc\/shadow/i,
  /cat\s+.*id_rsa/i,
  /cat\s+.*\.pem/i,
  /curl.*\|.*sh/i,                     // pipe to shell
  /wget.*\|.*sh/i,
  /curl.*\|.*bash/i,
  /wget.*\|.*bash/i,

  // ============================================
  // NETWORK ATTACKS
  // ============================================
  /nmap\s+/i,
  /nikto\s+/i,
  /sqlmap\s+/i,
  /hydra\s+/i,
  /metasploit/i,
  /msfconsole/i,
  /netcat\s+.*-e/i,                    // reverse shell
  /nc\s+.*-e/i,
  /bash\s+-i\s+>&/i,                   // bash reverse shell
];

// ============================================
// SECRET PATTERNS (Output Filtering)
// ============================================

const SECRET_PATTERNS: RegExp[] = [
  // API keys
  /sk-[a-zA-Z0-9]{32,}/g,           // Anthropic
  /sk-ant-[a-zA-Z0-9-]{32,}/g,      // Anthropic v2
  /xai-[a-zA-Z0-9]{32,}/g,          // OpenAI style
  /[a-f0-9]{64}/g,                   // Generic hex keys

  // AWS Credentials (CRITICAL)
  /AKIA[0-9A-Z]{16}/g,              // AWS Access Key ID
  /[A-Za-z0-9/+=]{40}/g,            // AWS Secret Access Key (base64-ish)
  /aws_access_key_id[=:]\s*["']?[^\s"']+/gi,
  /aws_secret_access_key[=:]\s*["']?[^\s"']+/gi,
  /AWS_ACCESS_KEY_ID[=:]\s*["']?[^\s"']+/gi,
  /AWS_SECRET_ACCESS_KEY[=:]\s*["']?[^\s"']+/gi,
  /AWS_SESSION_TOKEN[=:]\s*["']?[^\s"']+/gi,

  // Private keys
  /-----BEGIN.*PRIVATE KEY-----[\s\S]*?-----END.*PRIVATE KEY-----/g,
  /-----BEGIN RSA PRIVATE KEY-----[\s\S]*?-----END RSA PRIVATE KEY-----/g, // gitleaks:allow scanner regex only
  /-----BEGIN EC PRIVATE KEY-----[\s\S]*?-----END EC PRIVATE KEY-----/g,
  /[1-9A-HJ-NP-Za-km-z]{87,88}/g,   // Base58 private keys (Solana)

  // Database URLs
  /postgres(ql)?:\/\/[^\s]+/gi,
  /mysql:\/\/[^\s]+/gi,
  /mongodb(\+srv)?:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,

  // Tokens
  /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,  // JWTs
  /ghp_[a-zA-Z0-9]{36}/g,           // GitHub tokens
  /gho_[a-zA-Z0-9]{36}/g,           // GitHub OAuth
  /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g,  // Slack Bot Token
  /xoxp-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g,  // Slack User Token

  // Environment-specific
  /SUPABASE_SECRET_KEY[=:]\s*["']?[^\s"']+/gi,
  /SUPABASE_SERVICE_ROLE_KEY[=:]\s*["']?[^\s"']+/gi,
  /ANTHROPIC_API_KEY[=:]\s*["']?[^\s"']+/gi,
  /TELEGRAM_BOT_TOKEN[=:]\s*["']?[^\s"']+/gi,
  /KALSHI_API_SECRET[=:]\s*["']?[^\s"']+/gi,
  /SOLANA_PRIVATE_KEY[=:]\s*["']?[^\s"']+/gi,
  /HELIUS_API_KEY[=:]\s*["']?[^\s"']+/gi,
  /OPENAI_API_KEY[=:]\s*["']?[^\s"']+/gi,
  /STRIPE_SECRET_KEY[=:]\s*["']?[^\s"']+/gi,
  /TWILIO_AUTH_TOKEN[=:]\s*["']?[^\s"']+/gi,
  /DATABASE_URL[=:]\s*["']?[^\s"']+/gi,
];

// ============================================
// RATE LIMITING
// ============================================

const userRateLimits = new Map<string, UserSecurityProfile['requestCount']>();

const RATE_LIMITS: Record<UserTier, { perMinute: number; perHour: number }> = {
  public: { perMinute: 5, perHour: 30 },
  verified: { perMinute: 20, perHour: 200 },
  super_admin: { perMinute: 100, perHour: 1000 },
};

// ============================================
// AUDIT LOG
// ============================================

interface AuditEntry {
  timestamp: Date;
  telegramId: string;
  username?: string;
  action: 'command' | 'blocked' | 'rate_limited' | 'injection_attempt' | 'secret_scrubbed' | 'typo_suggestion';
  command?: string;
  reason?: string;
  suggestion?: string;
  tier: UserTier;
}

const auditLog: AuditEntry[] = [];
const MAX_AUDIT_LOG_SIZE = 10000;

function logAudit(entry: Omit<AuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date() });

  // Keep log size manageable
  if (auditLog.length > MAX_AUDIT_LOG_SIZE) {
    auditLog.shift();
  }

  // Log to console for critical events
  if (entry.action === 'injection_attempt' || entry.action === 'blocked') {
    console.warn(`[SECURITY] ${entry.action.toUpperCase()}: User ${entry.telegramId} - ${entry.reason || entry.command}`);
  }
}

// ============================================
// MAIN SECURITY FUNCTIONS
// ============================================

/**
 * Get user's security tier
 */
export function getUserTier(telegramId: string): UserTier {
  // Super admin check (only you)
  if (telegramId === SUPER_ADMIN_ID) return 'super_admin';
  // Pre-verified from env
  if (VERIFIED_IDS.includes(telegramId)) return 'verified';
  // Dynamic verification (auto-verified users)
  if (dynamicVerifiedUsers.has(telegramId)) return 'verified';
  return 'public';
}

/**
 * Check if user can execute a command
 */
export function isCommandAllowed(telegramId: string, command: string): { allowed: boolean; reason?: string } {
  const tier = getUserTier(telegramId);
  const cmd = command.split(' ')[0].toLowerCase();

  // Super admin commands - ONLY you (5504043269)
  if (SUPER_ADMIN_COMMANDS.includes(cmd)) {
    if (tier !== 'super_admin') {
      logAudit({ telegramId, action: 'blocked', command: cmd, reason: 'super_admin_only', tier });
      return { allowed: false, reason: 'This command is restricted.' };
    }
    return { allowed: true };
  }

  // Super admin can use ALL commands
  if (tier === 'super_admin') {
    return { allowed: true };
  }

  // Check tier allowlist
  let allowedCommands: string[];
  switch (tier) {
    case 'verified':
      allowedCommands = VERIFIED_COMMANDS;
      break;
    default:
      allowedCommands = PUBLIC_COMMANDS;
  }

  // Check if command is in allowlist (or is a general text query)
  const isKnownCommand = cmd.startsWith('/');
  if (isKnownCommand && !allowedCommands.includes(cmd)) {
    // Check if it's a typo - suggest similar command
    const allCommands = [...new Set([...PUBLIC_COMMANDS, ...VERIFIED_COMMANDS])];
    const suggestion = findSimilarCommand(cmd, allCommands);

    if (suggestion) {
      logAudit({ telegramId, action: 'typo_suggestion', command: cmd, suggestion, tier });
      return {
        allowed: false,
        reason: `Unknown command "${cmd}". Did you mean ${suggestion}?`
      };
    }

    logAudit({ telegramId, action: 'blocked', command: cmd, reason: 'not_in_allowlist', tier });
    return {
      allowed: false,
      reason: 'This command requires a verified account. Make a prediction with /predict to get started!'
    };
  }

  return { allowed: true };
}

/**
 * Simple Levenshtein distance for typo detection
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find similar command for typo suggestions
 */
function findSimilarCommand(typo: string, commands: string[]): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const cmd of commands) {
    const distance = levenshteinDistance(typo.toLowerCase(), cmd.toLowerCase());
    // Only suggest if distance is small (1-2 characters off)
    if (distance <= 2 && distance < bestDistance) {
      bestDistance = distance;
      bestMatch = cmd;
    }
  }

  return bestMatch;
}

/**
 * Sanitize input for prompt injection attempts
 */
export function sanitizeInput(
  telegramId: string,
  text: string
): { safe: boolean; sanitized: string; reason?: string } {
  const tier = getUserTier(telegramId);

  // Super admin bypasses injection checks (you can use builder commands)
  if (tier === 'super_admin') {
    return { safe: true, sanitized: text };
  }

  // Check for banned patterns
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(text)) {
      logAudit({
        telegramId,
        action: 'injection_attempt',
        command: text.slice(0, 100),
        reason: `Pattern: ${pattern.source.slice(0, 50)}`,
        tier
      });
      return {
        safe: false,
        sanitized: '',
        reason: "I can only help with prediction market analysis. Try /help to see what I can do!"
      };
    }
  }

  // Remove any attempts to include special tokens
  let sanitized = text
    .replace(/\[SYSTEM\]/gi, '')
    .replace(/\[INST\]/gi, '')
    .replace(/\[\/INST\]/gi, '')
    .replace(/<\|.*?\|>/g, '')
    .replace(/<<SYS>>.*?<<\/SYS>>/gis, '');

  return { safe: true, sanitized };
}

/**
 * Filter output to remove any accidentally leaked secrets
 */
export function filterOutput(text: string, telegramId?: string): string {
  let filtered = text;
  let scrubbed = false;

  // Preserve blockchain explorer URLs before redaction
  // These contain TX signatures that look like secrets but are public data
  const explorerUrlPlaceholders: { placeholder: string; url: string }[] = [];
  const explorerPatterns = [
    /https?:\/\/solscan\.io\/tx\/[A-Za-z0-9]+(?:\?[^\s)]*)?/g,
    /https?:\/\/solscan\.io\/account\/[A-Za-z0-9]+(?:\?[^\s)]*)?/g,
    /https?:\/\/explorer\.solana\.com\/tx\/[A-Za-z0-9]+(?:\?[^\s)]*)?/g,
    /https?:\/\/solana\.fm\/tx\/[A-Za-z0-9]+(?:\?[^\s)]*)?/g,
  ];

  // Extract and replace explorer URLs with placeholders
  let placeholderIndex = 0;
  for (const pattern of explorerPatterns) {
    filtered = filtered.replace(pattern, (match) => {
      const placeholder = `__EXPLORER_URL_${placeholderIndex}__`;
      explorerUrlPlaceholders.push({ placeholder, url: match });
      placeholderIndex++;
      return placeholder;
    });
  }

  // Apply secret redaction
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(filtered)) {
      filtered = filtered.replace(pattern, '[REDACTED]');
      scrubbed = true;
    }
  }

  // Restore explorer URLs
  for (const { placeholder, url } of explorerUrlPlaceholders) {
    filtered = filtered.replace(placeholder, url);
  }

  // Also filter file paths that might reveal server structure
  filtered = filtered.replace(/\/Users\/[^/\s]+/g, '/***');
  filtered = filtered.replace(/\/home\/[^/\s]+/g, '/***');
  filtered = filtered.replace(/C:\\Users\\[^\\]+/g, 'C:\\***');

  if (scrubbed && telegramId) {
    logAudit({ telegramId, action: 'secret_scrubbed', tier: getUserTier(telegramId) });
  }

  return filtered;
}

/**
 * Check rate limit
 */
export function checkRateLimit(telegramId: string): { allowed: boolean; reason?: string; retryAfter?: number } {
  const tier = getUserTier(telegramId);
  const limits = RATE_LIMITS[tier];
  const now = Date.now();

  let userLimits = userRateLimits.get(telegramId);

  if (!userLimits) {
    userLimits = {
      minute: 0,
      hour: 0,
      minuteReset: now + 60000,
      hourReset: now + 3600000,
    };
    userRateLimits.set(telegramId, userLimits);
  }

  // Reset counters if time has passed
  if (now > userLimits.minuteReset) {
    userLimits.minute = 0;
    userLimits.minuteReset = now + 60000;
  }
  if (now > userLimits.hourReset) {
    userLimits.hour = 0;
    userLimits.hourReset = now + 3600000;
  }

  // Check limits
  if (userLimits.minute >= limits.perMinute) {
    const retryAfter = Math.ceil((userLimits.minuteReset - now) / 1000);
    logAudit({ telegramId, action: 'rate_limited', reason: 'minute_limit', tier });
    return {
      allowed: false,
      reason: `Too many requests. Please wait ${retryAfter} seconds.`,
      retryAfter
    };
  }

  if (userLimits.hour >= limits.perHour) {
    const retryAfter = Math.ceil((userLimits.hourReset - now) / 1000);
    logAudit({ telegramId, action: 'rate_limited', reason: 'hour_limit', tier });
    return {
      allowed: false,
      reason: `Hourly limit reached. Please try again later.`,
      retryAfter
    };
  }

  // Increment counters
  userLimits.minute++;
  userLimits.hour++;

  return { allowed: true };
}

/**
 * Full security check pipeline
 */
export function securityCheck(
  telegramId: string,
  text: string
): {
  allowed: boolean;
  sanitizedText: string;
  reason?: string;
  tier: UserTier;
} {
  const tier = getUserTier(telegramId);

  // 1. Rate limit check
  const rateLimitResult = checkRateLimit(telegramId);
  if (!rateLimitResult.allowed) {
    return {
      allowed: false,
      sanitizedText: '',
      reason: rateLimitResult.reason,
      tier
    };
  }

  // 2. Input sanitization
  const sanitizeResult = sanitizeInput(telegramId, text);
  if (!sanitizeResult.safe) {
    return {
      allowed: false,
      sanitizedText: '',
      reason: sanitizeResult.reason,
      tier
    };
  }

  // 3. Command allowlist check
  const commandResult = isCommandAllowed(telegramId, sanitizeResult.sanitized);
  if (!commandResult.allowed) {
    return {
      allowed: false,
      sanitizedText: '',
      reason: commandResult.reason,
      tier
    };
  }

  // 4. Log successful command
  const cmd = text.split(' ')[0];
  if (cmd.startsWith('/')) {
    logAudit({ telegramId, action: 'command', command: cmd, tier });
  }

  return {
    allowed: true,
    sanitizedText: sanitizeResult.sanitized,
    tier
  };
}

/**
 * Get recent audit log (admin only)
 */
export function getAuditLog(limit = 100): AuditEntry[] {
  return auditLog.slice(-limit);
}

/**
 * Get security stats (admin only)
 */
export function getSecurityStats(): {
  totalRequests: number;
  blockedRequests: number;
  injectionAttempts: number;
  rateLimitedRequests: number;
  secretsScrubbed: number;
} {
  const stats = {
    totalRequests: auditLog.filter(e => e.action === 'command').length,
    blockedRequests: auditLog.filter(e => e.action === 'blocked').length,
    injectionAttempts: auditLog.filter(e => e.action === 'injection_attempt').length,
    rateLimitedRequests: auditLog.filter(e => e.action === 'rate_limited').length,
    secretsScrubbed: auditLog.filter(e => e.action === 'secret_scrubbed').length,
  };
  return stats;
}

// ============================================
// DYNAMIC USER VERIFICATION
// ============================================

/**
 * Verify a user (call after they make a prediction or connect wallet)
 */
export function verifyUser(telegramId: string): void {
  dynamicVerifiedUsers.add(telegramId);
  console.log(`[Security] User ${telegramId} auto-verified`);
}

/**
 * Check if user is dynamically verified
 */
export function isDynamicallyVerified(telegramId: string): boolean {
  return dynamicVerifiedUsers.has(telegramId);
}

// Alias for backward compatibility
export const getUserTierWithDynamic = getUserTier;
