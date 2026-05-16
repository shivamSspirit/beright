/**
 * Autonomous Scanner Stub
 *
 * This is a placeholder for the autonomous scanner feature.
 * The full implementation is not yet complete.
 */

export interface OpportunityScore {
  ticker: string;
  title: string;
  currentPrice: number;
  volume: number;
  category: string;
  expectedEdge: number;
  score: number;
}

export interface ScanResult {
  marketsScanned: number;
  topOpportunities: OpportunityScore[];
}

export interface AutonomousScanner {
  scan(): Promise<ScanResult>;
}

/**
 * Get scanner instance (stub - returns null when not implemented)
 */
export function getScanner(): AutonomousScanner | null {
  // Scanner not implemented yet
  return null;
}
