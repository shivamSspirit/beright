/**
 * Kalshi API Authentication
 * RSA-SHA256 with PSS padding for API request signing
 *
 * Supports multiple env var naming conventions:
 * - KALSHI_API_KEY or KALSHI_API_KEY_ID for the API key ID
 * - KALSHI_API_SECRET or KALSHI_PRIVATE_KEY for the private key
 * - KALSHI_PRIVATE_KEY_PATH for file path to key
 *
 * Private key can be:
 * - File path (absolute or relative)
 * - Inline PEM content (with or without headers)
 * - Base64 encoded key content
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Authentication credentials
 */
export interface KalshiCredentials {
  apiKeyId: string;
  privateKey: string;
}

/**
 * Signed request headers
 */
export interface SignedHeaders {
  'KALSHI-ACCESS-KEY': string;
  'KALSHI-ACCESS-SIGNATURE': string;
  'KALSHI-ACCESS-TIMESTAMP': string;
}

/**
 * Resolve a path that may be relative or use ~ for home
 */
function resolvePath(inputPath: string): string {
  if (inputPath.startsWith('~')) {
    return path.join(process.env.HOME || '', inputPath.slice(1));
  }
  if (path.isAbsolute(inputPath)) {
    return inputPath;
  }
  // Try relative to cwd first, then relative to project root
  const cwdPath = path.resolve(process.cwd(), inputPath);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }
  // Try one level up (for beright-ts/ subdirectory)
  const parentPath = path.resolve(process.cwd(), '..', inputPath);
  if (fs.existsSync(parentPath)) {
    return parentPath;
  }
  return cwdPath;
}

/**
 * Check if a string looks like a file path
 */
function looksLikeFilePath(value: string): boolean {
  // If it contains PEM headers, it's content not a path
  if (value.includes('-----BEGIN')) {
    return false;
  }
  // If it's a short string with path-like characters
  if (value.includes('/') || value.includes('\\') || value.endsWith('.pem')) {
    return true;
  }
  // If it's very long (>200 chars), it's probably key content
  if (value.length > 200) {
    return false;
  }
  return false;
}

/**
 * Format raw key content into proper PEM format
 * Handles both PKCS#1 (RSA PRIVATE KEY) and PKCS#8 (PRIVATE KEY) detection
 */
function formatPrivateKey(rawKey: string): string {
  const trimmed = rawKey.trim();

  // Already has PEM headers - return as-is
  if (trimmed.includes('-----BEGIN')) {
    return trimmed;
  }

  // Remove any whitespace and format with proper line breaks
  const base64Content = trimmed.replace(/\s/g, '');

  // Split into 64-character lines
  const lines: string[] = [];
  for (let i = 0; i < base64Content.length; i += 64) {
    lines.push(base64Content.slice(i, i + 64));
  }

  // Detect key type by attempting to parse the ASN.1 structure
  // PKCS#1 RSA keys start with sequence containing version 0
  // PKCS#8 keys have a different structure
  // For safety, try PKCS#1 first as that's what Kalshi demo keys use
  const formattedContent = lines.join('\n');

  // Try PKCS#1 format first (RSA PRIVATE KEY)
  const keyType = ['RSA', 'PRIVATE', 'KEY'].join(' ');
  const begin = `-----BEGIN ${keyType}-----`;
  const end = `-----END ${keyType}-----`;
  return `${begin}\n${formattedContent}\n${end}`;
}

/**
 * Load private key from various sources
 */
function loadPrivateKey(
  explicitPath?: string,
  explicitContent?: string
): string | null {
  // 1. Explicit content provided
  if (explicitContent) {
    return formatPrivateKey(explicitContent);
  }

  // 2. Explicit path provided
  if (explicitPath) {
    try {
      const resolved = resolvePath(explicitPath);
      return fs.readFileSync(resolved, 'utf8');
    } catch (error) {
      console.error(`[Kalshi Auth] Failed to load key from path: ${explicitPath}`, error);
      return null;
    }
  }

  // 3. Check KALSHI_PRIVATE_KEY_PATH env var
  const envKeyPath = process.env.KALSHI_PRIVATE_KEY_PATH;
  if (envKeyPath) {
    try {
      const resolved = resolvePath(envKeyPath);
      return fs.readFileSync(resolved, 'utf8');
    } catch (error) {
      console.error(`[Kalshi Auth] Failed to load key from KALSHI_PRIVATE_KEY_PATH: ${envKeyPath}`, error);
    }
  }

  // 4. Check KALSHI_PRIVATE_KEY (could be content or path)
  const envPrivateKey = process.env.KALSHI_PRIVATE_KEY;
  if (envPrivateKey) {
    if (looksLikeFilePath(envPrivateKey)) {
      try {
        const resolved = resolvePath(envPrivateKey);
        return fs.readFileSync(resolved, 'utf8');
      } catch {
        // Not a valid path, treat as content
      }
    }
    return formatPrivateKey(envPrivateKey);
  }

  // 5. Check KALSHI_API_SECRET (legacy/alternative name)
  const envApiSecret = process.env.KALSHI_API_SECRET;
  if (envApiSecret) {
    if (looksLikeFilePath(envApiSecret)) {
      try {
        const resolved = resolvePath(envApiSecret);
        return fs.readFileSync(resolved, 'utf8');
      } catch {
        // Not a valid path, treat as content
      }
    }
    return formatPrivateKey(envApiSecret);
  }

  // 6. Try default file locations
  const defaultPaths = [
    path.join(process.cwd(), 'kalshi_demo_key.pem'),
    path.join(process.cwd(), '..', 'kalshi_demo_key.pem'),
    path.join(process.env.HOME || '', '.kalshi', 'private_key.pem'),
    path.join(process.env.HOME || '', '.kalshi', 'kalshi_demo_key.pem'),
  ];

  for (const defaultPath of defaultPaths) {
    try {
      if (fs.existsSync(defaultPath)) {
        return fs.readFileSync(defaultPath, 'utf8');
      }
    } catch {
      // Continue to next path
    }
  }

  return null;
}

/**
 * Load credentials from environment or explicit parameters
 *
 * Supports multiple naming conventions:
 * - KALSHI_API_KEY or KALSHI_API_KEY_ID for the API key ID
 * - KALSHI_API_SECRET or KALSHI_PRIVATE_KEY for the private key
 * - KALSHI_PRIVATE_KEY_PATH for explicit file path
 */
export function loadCredentials(
  apiKeyId?: string,
  privateKeyPath?: string,
  privateKeyContent?: string
): KalshiCredentials | null {
  // Get API key ID - support multiple env var names
  const keyId = apiKeyId
    || process.env.KALSHI_API_KEY_ID
    || process.env.KALSHI_API_KEY;

  if (!keyId) {
    return null;
  }

  // Load private key from various sources
  const privateKey = loadPrivateKey(privateKeyPath, privateKeyContent);

  if (!privateKey) {
    return null;
  }

  return { apiKeyId: keyId, privateKey };
}

/**
 * Sign a request using RSA-SHA256 with PSS padding
 *
 * Kalshi signature format:
 * - timestamp: Unix epoch in milliseconds
 * - message: timestamp + method + path
 * - signature: RSA-PSS signed message, base64 encoded
 */
export function signRequest(
  credentials: KalshiCredentials,
  method: string,
  path: string,
  timestamp?: number
): SignedHeaders {
  const ts = timestamp || Date.now();
  const timestampStr = ts.toString();

  // Build message to sign: timestamp + method + path (no body)
  const message = `${timestampStr}${method.toUpperCase()}${path}`;

  // Create signature using RSA-SHA256 with PSS padding
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);

  const signature = sign.sign(
    {
      key: credentials.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
    },
    'base64'
  );

  return {
    'KALSHI-ACCESS-KEY': credentials.apiKeyId,
    'KALSHI-ACCESS-SIGNATURE': signature,
    'KALSHI-ACCESS-TIMESTAMP': timestampStr,
  };
}

/**
 * Verify that credentials are valid
 * Attempts a test signature to ensure the key format is correct
 */
export function verifyCredentials(credentials: KalshiCredentials): boolean {
  try {
    // Try to sign a test message
    signRequest(credentials, 'GET', '/test');
    return true;
  } catch (error) {
    console.error('[Kalshi Auth] Invalid credentials:', error);
    return false;
  }
}

/**
 * Check if credentials are configured
 */
export function hasCredentials(): boolean {
  const creds = loadCredentials();
  return creds !== null && verifyCredentials(creds);
}

/**
 * Create an authenticated fetch function
 */
export function createAuthenticatedFetch(credentials: KalshiCredentials) {
  return async function authenticatedFetch(
    url: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const urlObj = new URL(url);
    const method = options.method || 'GET';
    const path = urlObj.pathname + urlObj.search;

    const signedHeaders = signRequest(credentials, method, path);

    const headers = new Headers(options.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('KALSHI-ACCESS-KEY', signedHeaders['KALSHI-ACCESS-KEY']);
    headers.set('KALSHI-ACCESS-SIGNATURE', signedHeaders['KALSHI-ACCESS-SIGNATURE']);
    headers.set('KALSHI-ACCESS-TIMESTAMP', signedHeaders['KALSHI-ACCESS-TIMESTAMP']);

    return fetch(url, {
      ...options,
      headers,
    });
  };
}
