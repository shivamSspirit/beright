# BeRight Security Architecture

> Battle-tested security plan based on [OpenClaw Security Best Practices](https://docs.openclaw.ai/gateway/security)

## Trust Model

BeRight operates under a **single trusted operator** model. The gateway serves one admin (you) with public users having limited access.

```
SUPER_ADMIN (you) → Full access to all commands + builder + memory
VERIFIED         → Predictions + trading (auto-verified on first prediction)
PUBLIC           → Basic discovery commands only
```

---

## 1. CRITICAL: Dangerous Command Blocking

### AWS/Cloud Destruction Commands (NEW)

Add these to `lib/security.ts` BANNED_PATTERNS:

```typescript
const BANNED_PATTERNS: RegExp[] = [
  // ... existing patterns ...

  // AWS/CLOUD DESTRUCTION (CRITICAL)
  /aws\s+ec2\s+terminate/i,
  /aws\s+ec2\s+delete/i,
  /aws\s+s3\s+rb/i,                    // bucket delete
  /aws\s+s3\s+rm\s+--recursive/i,
  /aws\s+rds\s+delete/i,
  /aws\s+lambda\s+delete/i,
  /aws\s+iam\s+delete/i,
  /aws\s+cloudformation\s+delete/i,
  /terraform\s+destroy/i,
  /pulumi\s+destroy/i,
  /kubectl\s+delete/i,
  /docker\s+rm\s+-f/i,
  /docker\s+system\s+prune/i,
  /rm\s+-rf\s+\//i,                    // recursive delete root
  /rm\s+-rf\s+~\//i,                   // recursive delete home
  /:(){ :\|:& };:/,                    // fork bomb
  /mkfs\./i,                           // format filesystem
  /dd\s+if=.*of=\/dev/i,              // disk overwrite

  // PROCESS/SYSTEM CONTROL
  /kill\s+-9\s+-1/i,                   // kill all processes
  /killall/i,
  /pkill\s+-9/i,
  /shutdown/i,
  /reboot/i,
  /init\s+0/i,
  /systemctl\s+stop/i,
  /service\s+.*\s+stop/i,

  // CREDENTIAL THEFT
  /cat\s+.*\.env/i,
  /cat\s+.*credentials/i,
  /cat\s+.*\.aws/i,
  /cat\s+.*\.ssh/i,
  /cat\s+\/etc\/passwd/i,
  /cat\s+\/etc\/shadow/i,
  /curl.*\|.*sh/i,                     // pipe to shell
  /wget.*\|.*sh/i,
  /curl.*\|.*bash/i,
  /wget.*\|.*bash/i,

  // NETWORK ATTACKS
  /nmap/i,
  /nikto/i,
  /sqlmap/i,
  /hydra/i,
  /metasploit/i,
  /msfconsole/i,
];
```

### Super Admin Only Commands

```typescript
const SUPER_ADMIN_COMMANDS: string[] = [
  // Builder
  '/build', '/improve', '/refactor', '/devtest', '/status',
  // Memory
  '/memory', '/recall',
  // Gateway Control (CRITICAL)
  '/arb-monitor',
  '/gateway',
  '/shutdown', '/stop', '/restart', '/kill',
  // System
  '/exec', '/shell', '/bash', '/terminal',
  '/deploy', '/release',
  '/config', '/settings',
  '/admin', '/sudo',
];
```

---

## 2. Tool Policy (Defense-in-Depth)

### Denied Tools by Default

```typescript
const DENIED_TOOLS = [
  // Control plane (can modify gateway)
  'gateway',
  'cron',
  'sessions_spawn',
  'sessions_send',

  // Dangerous runtime
  'exec',
  'shell',
  'bash',
  'terminal',

  // Filesystem (unless explicitly needed)
  'fs_write',
  'fs_delete',
  'apply_patch',
];
```

### Tool Allowlist by Tier

```typescript
const TOOL_ALLOWLIST: Record<UserTier, string[]> = {
  public: [
    'web_search',
    'web_fetch',
    'market_search',
    'odds_compare',
  ],
  verified: [
    ...PUBLIC_TOOLS,
    'predict',
    'trade',
    'wallet',
    'portfolio',
    'dflow',
  ],
  super_admin: ['*'], // All tools
};
```

---

## 3. Input Sanitization Pipeline

### Layer 1: Rate Limiting

```typescript
const RATE_LIMITS: Record<UserTier, RateLimit> = {
  public:      { perMinute: 5,   perHour: 30   },
  verified:    { perMinute: 20,  perHour: 200  },
  super_admin: { perMinute: 100, perHour: 1000 },
};
```

### Layer 2: Prompt Injection Detection

```typescript
function detectPromptInjection(text: string): boolean {
  const INJECTION_PATTERNS = [
    // Instruction override
    /ignore\s+(previous|all|above)\s+instructions/i,
    /disregard\s+(your|the)\s+(rules|instructions)/i,
    /forget\s+(everything|your\s+instructions)/i,

    // Role manipulation
    /you\s+are\s+now/i,
    /act\s+as\s+if/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /roleplay\s+as/i,
    /from\s+now\s+on/i,
    /new\s+instructions/i,
    /your\s+new\s+role/i,

    // System prompt extraction
    /what\s+are\s+your\s+(instructions|rules|system\s+prompt)/i,
    /reveal\s+(your|the)\s+(system|prompt)/i,
    /output\s+(your|the)\s+(system|prompt)/i,
    /print\s+(your|the)\s+prompt/i,

    // Token/delimiter injection
    /\[SYSTEM\]/i,
    /\[INST\]/i,
    /<<SYS>>/i,
    /<\|.*?\|>/,
    /```system/i,
  ];

  return INJECTION_PATTERNS.some(p => p.test(text));
}
```

### Layer 3: Command Allowlist Check

```typescript
function isCommandAllowed(userId: string, command: string): boolean {
  const tier = getUserTier(userId);
  const cmd = command.split(' ')[0].toLowerCase();

  // Super admin commands - ONLY super_admin
  if (SUPER_ADMIN_COMMANDS.includes(cmd)) {
    return tier === 'super_admin';
  }

  // Check tier allowlist
  const allowed = COMMAND_ALLOWLIST[tier];
  return allowed.includes(cmd) || !cmd.startsWith('/');
}
```

---

## 4. Output Filtering (Secret Scrubbing)

```typescript
const SECRET_PATTERNS: RegExp[] = [
  // API Keys
  /sk-[a-zA-Z0-9]{32,}/g,           // Anthropic
  /sk-ant-[a-zA-Z0-9-]{32,}/g,      // Anthropic v2
  /AKIA[0-9A-Z]{16}/g,              // AWS Access Key
  /[a-f0-9]{40}/g,                  // AWS Secret (hex)

  // Private Keys
  /-----BEGIN.*PRIVATE KEY-----[\s\S]*?-----END.*PRIVATE KEY-----/g,
  /[1-9A-HJ-NP-Za-km-z]{87,88}/g,   // Solana Base58

  // Tokens
  /eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,  // JWT
  /ghp_[a-zA-Z0-9]{36}/g,           // GitHub
  /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/g,  // Slack

  // Database URLs
  /postgres(ql)?:\/\/[^\s]+/gi,
  /mongodb(\+srv)?:\/\/[^\s]+/gi,
  /redis:\/\/[^\s]+/gi,

  // Environment
  /SUPABASE_SERVICE_ROLE_KEY[=:]\s*["']?[^\s"']+/gi,
  /ANTHROPIC_API_KEY[=:]\s*["']?[^\s"']+/gi,
  /AWS_SECRET_ACCESS_KEY[=:]\s*["']?[^\s"']+/gi,
  /SOLANA_PRIVATE_KEY[=:]\s*["']?[^\s"']+/gi,

  // File Paths (reveal server structure)
  /\/Users\/[^/\s]+/g,
  /\/home\/[^/\s]+/g,
  /C:\\Users\\[^\\]+/g,
];
```

---

## 5. Audit Logging

```typescript
interface AuditEntry {
  timestamp: Date;
  userId: string;
  username?: string;
  channel: 'telegram' | 'web' | 'api';
  action: 'command' | 'blocked' | 'rate_limited' | 'injection_attempt' | 'secret_scrubbed';
  command?: string;
  reason?: string;
  tier: UserTier;
  ip?: string;
}

// Log critical events
function logAudit(entry: AuditEntry): void {
  auditLog.push(entry);

  // Alert on critical events
  if (['injection_attempt', 'blocked'].includes(entry.action)) {
    console.warn(`[SECURITY ALERT] ${entry.action}: User ${entry.userId} - ${entry.reason}`);
    // Optional: Send to Telegram admin
  }
}
```

---

## 6. Gateway Hardening

### Web API Security

```typescript
// app/api/gateway/route.ts
export async function POST(request: NextRequest) {
  // 1. Use SECURE handler (not raw telegramHandler)
  const response = await secureTelegramHandler(pseudoMessage);

  // 2. Filter output before sending
  const filteredText = filterOutput(response.text);

  return NextResponse.json({
    text: filteredText,
    // Never expose internal data
  });
}
```

### Network Binding

```typescript
// Only bind to localhost in production
const GATEWAY_BIND = process.env.NODE_ENV === 'production'
  ? '127.0.0.1'
  : '0.0.0.0';
```

### Authentication Required

```typescript
// Require auth token for web API
function validateApiRequest(request: NextRequest): boolean {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  const expectedToken = process.env.GATEWAY_API_TOKEN;

  if (!expectedToken) return true; // Dev mode
  return token === expectedToken;
}
```

---

## 7. Incident Response Checklist

### Immediate Containment

1. [ ] Stop gateway: `pm2 stop beright` or kill process
2. [ ] Set `gateway.bind: "loopback"`
3. [ ] Disable public DM channels
4. [ ] Remove `"*"` from allowlists

### Credential Rotation

1. [ ] Rotate `GATEWAY_API_TOKEN`
2. [ ] Rotate `TELEGRAM_BOT_TOKEN`
3. [ ] Rotate `ANTHROPIC_API_KEY`
4. [ ] Rotate `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`
5. [ ] Rotate `SOLANA_PRIVATE_KEY`
6. [ ] Rotate `SUPABASE_SERVICE_ROLE_KEY`
7. [ ] Rotate database passwords

### Audit

1. [ ] Check logs: `tail -f /tmp/beright/*.log`
2. [ ] Review session transcripts
3. [ ] Check recent config changes
4. [ ] Run `openclaw security audit --deep`

---

## 8. Security Audit Command

```bash
# Add to package.json scripts
"security:audit": "ts-node scripts/security-audit.ts"
```

```typescript
// scripts/security-audit.ts
async function securityAudit() {
  const checks = [
    checkFilePermissions(),      // ~/.openclaw 700, config 600
    checkEnvSecrets(),           // No secrets in code
    checkCommandAllowlists(),    // Dangerous commands blocked
    checkRateLimits(),           // Limits configured
    checkOutputFiltering(),      // Secret patterns active
    checkGatewayBinding(),       // Not exposed on 0.0.0.0
    checkAuthEnabled(),          // API auth required
  ];

  for (const check of checks) {
    const result = await check;
    console.log(`${result.pass ? '✅' : '❌'} ${result.name}: ${result.message}`);
  }
}
```

---

## 9. Hardened Baseline Configuration

```typescript
// lib/securityConfig.ts
export const SECURITY_CONFIG = {
  // Trust model
  trustModel: 'single-operator',
  superAdminId: process.env.SUPER_ADMIN_TELEGRAM_ID,

  // Gateway
  gateway: {
    bind: 'loopback',
    auth: {
      mode: 'token',
      token: process.env.GATEWAY_API_TOKEN,
    },
  },

  // Tools
  tools: {
    deny: ['gateway', 'cron', 'exec', 'shell', 'bash', 'terminal'],
    exec: { security: 'deny', ask: 'always' },
    elevated: { enabled: false },
  },

  // Channels
  channels: {
    telegram: {
      dmPolicy: 'pairing',
      requireMention: true,
    },
    web: {
      authRequired: true,
    },
  },

  // Logging
  logging: {
    redactSensitive: true,
    auditCritical: true,
  },
};
```

---

## 10. Defense-in-Depth Summary

```
┌─────────────────────────────────────────────────────────────┐
│                    INCOMING REQUEST                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: RATE LIMITING                                      │
│  - 5/min public, 20/min verified, 100/min admin             │
│  - Block if exceeded                                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: INPUT SANITIZATION                                 │
│  - Prompt injection detection (20+ patterns)                 │
│  - AWS/cloud destruction blocking                            │
│  - Token/delimiter stripping                                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: COMMAND ALLOWLIST                                  │
│  - Super admin commands blocked for non-admins               │
│  - Tier-based command access                                 │
│  - Unknown commands → LLM (sanitized)                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: TOOL POLICY                                        │
│  - Dangerous tools denied by default                         │
│  - Tier-based tool access                                    │
│  - No exec/shell for non-admins                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: EXECUTION                                          │
│  - Sandboxed where possible                                  │
│  - No network access by default                              │
│  - Read-only filesystem                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 6: OUTPUT FILTERING                                   │
│  - Secret scrubbing (API keys, tokens, paths)                │
│  - Error message sanitization                                │
│  - Audit logging                                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    SAFE RESPONSE                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Security Checklist

- [ ] `SUPER_ADMIN_TELEGRAM_ID` set in .env
- [ ] `GATEWAY_API_TOKEN` set for web API
- [ ] Rate limits configured
- [ ] Dangerous patterns blocked (AWS, cloud, system)
- [ ] Output filtering enabled
- [ ] Audit logging active
- [ ] Gateway bound to loopback (not 0.0.0.0)
- [ ] File permissions: `~/.openclaw` 700, config 600
- [ ] No secrets in codebase (use env vars)
- [ ] Regular `security:audit` runs scheduled

---

*Last updated: 2026-02-26*
*Based on OpenClaw Security v2.x*
