/**
 * Kalshi API Authentication
 * RSA-SHA256 with PSS padding for API request signing
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
 * Load credentials from environment or file
 */
export function loadCredentials(
  apiKeyId?: string,
  privateKeyPath?: string,
  privateKeyContent?: string
): KalshiCredentials | null {
  // Get API key ID
  const keyId = apiKeyId || process.env.KALSHI_API_KEY_ID;
  if (!keyId) {
    return null;
  }

  // Get private key
  let privateKey = privateKeyContent || process.env.KALSHI_PRIVATE_KEY;

  if (!privateKey && privateKeyPath) {
    try {
      const resolvedPath = privateKeyPath.startsWith('~')
        ? path.join(process.env.HOME || '', privateKeyPath.slice(1))
        : privateKeyPath;
      privateKey = fs.readFileSync(resolvedPath, 'utf8');
    } catch (error) {
      console.error('[Kalshi Auth] Failed to load private key:', error);
      return null;
    }
  }

  if (!privateKey) {
    // Try default path
    const defaultPath = path.join(process.env.HOME || '', '.kalshi', 'private_key.pem');
    try {
      privateKey = fs.readFileSync(defaultPath, 'utf8');
    } catch {
      return null;
    }
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
