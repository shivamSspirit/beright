/**
 * Secrets Manager for BeRight Protocol
 *
 * Centralized, validated, secure access to all secrets.
 * - Validates secrets exist before use
 * - Provides clear error messages
 * - Never logs secret values
 * - Supports graceful degradation
 *
 * PRODUCTION REQUIREMENTS:
 * - Use environment variables (Vercel, Railway, etc.)
 * - Never commit .env to git
 * - Rotate keys regularly
 * - Use secrets manager in production (AWS Secrets Manager, Vault, etc.)
 */

export interface SecretsConfig {
  // Solana
  solanaPrivateKey?: number[];
  heliusApiKey?: string;
  heliusRpcMainnet?: string;

  // Kalshi
  kalshiApiKey?: string;
  kalshiApiSecret?: string;

  // Supabase
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseServiceRoleKey?: string;

  // Telegram
  telegramBotToken?: string;

  // Anthropic
  anthropicApiKey?: string;

  // Upstash Redis
  upstashRedisUrl?: string;
  upstashRedisToken?: string;

  // Jito
  jitoAuthKeypair?: string;
}

class SecretsManager {
  private static instance: SecretsManager;
  private config: SecretsConfig = {};
  private initialized = false;
  private validationErrors: string[] = [];

  private constructor() {}

  static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  /**
   * Initialize secrets from environment
   * Call this once at application startup
   */
  initialize(): { valid: boolean; errors: string[] } {
    if (this.initialized) {
      return { valid: this.validationErrors.length === 0, errors: this.validationErrors };
    }

    this.validationErrors = [];

    // Parse Solana private key (JSON array format)
    const solanaKeyRaw = process.env.SOLANA_PRIVATE_KEY;
    if (solanaKeyRaw) {
      try {
        const parsed = JSON.parse(solanaKeyRaw);
        if (Array.isArray(parsed) && parsed.length === 64) {
          this.config.solanaPrivateKey = parsed;
        } else {
          this.validationErrors.push('SOLANA_PRIVATE_KEY must be a 64-byte array');
        }
      } catch {
        this.validationErrors.push('SOLANA_PRIVATE_KEY is not valid JSON');
      }
    }

    // Helius
    this.config.heliusApiKey = process.env.HELIUS_API_KEY;
    this.config.heliusRpcMainnet = process.env.HELIUS_RPC_MAINNET || process.env.SOLANA_RPC_URL;

    // Kalshi
    this.config.kalshiApiKey = process.env.KALSHI_API_KEY;
    this.config.kalshiApiSecret = process.env.KALSHI_API_SECRET;

    // Supabase
    this.config.supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    this.config.supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    this.config.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Telegram
    this.config.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

    // Anthropic
    this.config.anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    // Upstash Redis
    this.config.upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
    this.config.upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // Jito
    this.config.jitoAuthKeypair = process.env.JITO_AUTH_KEYPAIR;

    this.initialized = true;

    return { valid: this.validationErrors.length === 0, errors: this.validationErrors };
  }

  /**
   * Check if a specific secret is configured
   */
  has(key: keyof SecretsConfig): boolean {
    this.ensureInitialized();
    const value = this.config[key];
    return value !== undefined && value !== null && value !== '';
  }

  /**
   * Get Solana private key bytes
   * @throws if not configured
   */
  getSolanaPrivateKey(): Uint8Array {
    this.ensureInitialized();
    if (!this.config.solanaPrivateKey) {
      throw new SecretNotConfiguredError('SOLANA_PRIVATE_KEY');
    }
    return Uint8Array.from(this.config.solanaPrivateKey);
  }

  /**
   * Get Helius API key
   */
  getHeliusApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.heliusApiKey;
  }

  /**
   * Get Helius RPC URL
   */
  getHeliusRpcUrl(): string {
    this.ensureInitialized();
    return this.config.heliusRpcMainnet || 'https://api.mainnet-beta.solana.com';
  }

  /**
   * Get Kalshi credentials
   */
  getKalshiCredentials(): { apiKey: string; apiSecret: string } | null {
    this.ensureInitialized();
    if (!this.config.kalshiApiKey || !this.config.kalshiApiSecret) {
      return null;
    }
    return {
      apiKey: this.config.kalshiApiKey,
      apiSecret: this.config.kalshiApiSecret,
    };
  }

  /**
   * Get Supabase credentials
   */
  getSupabaseCredentials(): { url: string; anonKey: string; serviceRoleKey?: string } | null {
    this.ensureInitialized();
    if (!this.config.supabaseUrl || !this.config.supabaseAnonKey) {
      return null;
    }
    return {
      url: this.config.supabaseUrl,
      anonKey: this.config.supabaseAnonKey,
      serviceRoleKey: this.config.supabaseServiceRoleKey,
    };
  }

  /**
   * Get Telegram bot token
   */
  getTelegramBotToken(): string | undefined {
    this.ensureInitialized();
    return this.config.telegramBotToken;
  }

  /**
   * Get Anthropic API key
   */
  getAnthropicApiKey(): string | undefined {
    this.ensureInitialized();
    return this.config.anthropicApiKey;
  }

  /**
   * Get Upstash Redis credentials
   */
  getUpstashCredentials(): { url: string; token: string } | null {
    this.ensureInitialized();
    if (!this.config.upstashRedisUrl || !this.config.upstashRedisToken) {
      return null;
    }
    return {
      url: this.config.upstashRedisUrl,
      token: this.config.upstashRedisToken,
    };
  }

  /**
   * Validate required secrets for a specific feature
   */
  validateForFeature(feature: 'onchain' | 'kalshi' | 'telegram' | 'supabase' | 'agents'): {
    valid: boolean;
    missing: string[];
  } {
    this.ensureInitialized();
    const missing: string[] = [];

    switch (feature) {
      case 'onchain':
        if (!this.config.solanaPrivateKey) missing.push('SOLANA_PRIVATE_KEY');
        if (!this.config.heliusRpcMainnet) missing.push('HELIUS_RPC_MAINNET or SOLANA_RPC_URL');
        break;
      case 'kalshi':
        if (!this.config.kalshiApiKey) missing.push('KALSHI_API_KEY');
        if (!this.config.kalshiApiSecret) missing.push('KALSHI_API_SECRET');
        break;
      case 'telegram':
        if (!this.config.telegramBotToken) missing.push('TELEGRAM_BOT_TOKEN');
        break;
      case 'supabase':
        if (!this.config.supabaseUrl) missing.push('SUPABASE_URL');
        if (!this.config.supabaseAnonKey) missing.push('SUPABASE_ANON_KEY');
        break;
      case 'agents':
        if (!this.config.anthropicApiKey) missing.push('ANTHROPIC_API_KEY');
        break;
    }

    return { valid: missing.length === 0, missing };
  }

  /**
   * Get a summary of configured secrets (for logging, never includes values)
   */
  getConfigSummary(): Record<string, boolean> {
    this.ensureInitialized();
    return {
      solana: !!this.config.solanaPrivateKey,
      helius: !!this.config.heliusApiKey,
      kalshi: !!(this.config.kalshiApiKey && this.config.kalshiApiSecret),
      supabase: !!(this.config.supabaseUrl && this.config.supabaseAnonKey),
      telegram: !!this.config.telegramBotToken,
      anthropic: !!this.config.anthropicApiKey,
      upstash: !!(this.config.upstashRedisUrl && this.config.upstashRedisToken),
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.initialize();
    }
  }
}

/**
 * Error thrown when a required secret is not configured
 */
export class SecretNotConfiguredError extends Error {
  constructor(secretName: string) {
    super(`Required secret not configured: ${secretName}. Check your .env file.`);
    this.name = 'SecretNotConfiguredError';
  }
}

// Export singleton
export const secrets = SecretsManager.getInstance();

// Export a function to validate all secrets at startup
export function validateSecrets(): { valid: boolean; errors: string[]; summary: Record<string, boolean> } {
  const { valid, errors } = secrets.initialize();
  const summary = secrets.getConfigSummary();
  return { valid, errors, summary };
}
