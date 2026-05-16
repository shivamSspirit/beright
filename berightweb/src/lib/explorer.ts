/**
 * Solana Explorer URL Utilities
 *
 * Provides URLs for multiple explorers to give users choice:
 * - Solscan (solscan.io) - Popular community explorer
 * - Solana Explorer (explorer.solana.com) - Official explorer
 * - Orb Markets (orbmarkets.io) - Great for prediction market txs
 */

export type SolanaCluster = 'devnet' | 'mainnet-beta' | 'testnet';

export interface ExplorerLink {
  name: string;
  url: string;
  icon: 'solscan' | 'solana' | 'orb';
}

/**
 * Get Solscan transaction URL
 */
export function getSolscanTxUrl(signature: string, cluster: SolanaCluster = 'devnet'): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${signature}${clusterParam}`;
}

/**
 * Get official Solana Explorer transaction URL
 */
export function getSolanaExplorerTxUrl(signature: string, cluster: SolanaCluster = 'devnet'): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/tx/${signature}${clusterParam}`;
}

/**
 * Get Orb Markets transaction URL
 */
export function getOrbTxUrl(signature: string, cluster: SolanaCluster = 'devnet'): string {
  const clusterParam = cluster === 'mainnet-beta' ? 'mainnet' : cluster;
  return `https://orbmarkets.io/tx/${signature}?cluster=${clusterParam}&tab=summary`;
}

/**
 * Get all explorer URLs for a transaction
 * @param signature - Transaction signature
 * @param cluster - Solana cluster (defaults to devnet)
 * @returns Array of explorer links
 */
export function getAllExplorerUrls(signature: string, cluster: SolanaCluster = 'devnet'): ExplorerLink[] {
  return [
    { name: 'Solscan', url: getSolscanTxUrl(signature, cluster), icon: 'solscan' },
    { name: 'Solana Explorer', url: getSolanaExplorerTxUrl(signature, cluster), icon: 'solana' },
    { name: 'Orb', url: getOrbTxUrl(signature, cluster), icon: 'orb' },
  ];
}

/**
 * Get primary transaction URL (Orb for prediction markets)
 * @param signature - Transaction signature
 * @param cluster - Solana cluster (defaults to devnet)
 * @returns Full URL to view transaction on Orb Markets
 */
export function getTransactionUrl(signature: string, cluster: SolanaCluster = 'devnet'): string {
  return getOrbTxUrl(signature, cluster);
}

/**
 * Get Solscan account/address URL
 */
export function getSolscanAccountUrl(address: string, cluster: SolanaCluster = 'devnet'): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://solscan.io/account/${address}${clusterParam}`;
}

/**
 * Get official Solana Explorer account URL
 */
export function getSolanaExplorerAccountUrl(address: string, cluster: SolanaCluster = 'devnet'): string {
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://explorer.solana.com/address/${address}${clusterParam}`;
}

/**
 * Get Orb Markets account/address URL
 */
export function getOrbAccountUrl(address: string, cluster: SolanaCluster = 'devnet'): string {
  const clusterParam = cluster === 'mainnet-beta' ? 'mainnet' : cluster;
  return `https://orbmarkets.io/address/${address}?cluster=${clusterParam}`;
}

/**
 * Get all explorer URLs for an account/address
 */
export function getAllAccountExplorerUrls(address: string, cluster: SolanaCluster = 'devnet'): ExplorerLink[] {
  return [
    { name: 'Solscan', url: getSolscanAccountUrl(address, cluster), icon: 'solscan' },
    { name: 'Solana Explorer', url: getSolanaExplorerAccountUrl(address, cluster), icon: 'solana' },
    { name: 'Orb', url: getOrbAccountUrl(address, cluster), icon: 'orb' },
  ];
}

/**
 * Get primary account URL (Orb)
 */
export function getAccountUrl(address: string, cluster: SolanaCluster = 'devnet'): string {
  return getOrbAccountUrl(address, cluster);
}

/**
 * Get program URL
 */
export function getProgramUrl(programId: string, cluster: SolanaCluster = 'devnet'): string {
  return getAccountUrl(programId, cluster);
}

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use getTransactionUrl or getAllExplorerUrls instead
 */
export const getSolscanUrl = getTransactionUrl;

/**
 * Legacy alias for backwards compatibility
 * @deprecated Use getTransactionUrl or getAllExplorerUrls instead
 */
export const solscanTx = getTransactionUrl;
