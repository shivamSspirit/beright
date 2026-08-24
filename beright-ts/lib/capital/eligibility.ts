import { calculateCapitalRiskPrice } from './riskPrice';
import type {
  CapitalEligibility,
  CapitalEligibilityReason,
  CapitalMarketSnapshot,
  CapitalOrderbook,
} from './types';

export interface CapitalEligibilityPolicy {
  minimumDaysToResolution: number;
  minimumVolumeUsd: number;
  minimumOpenInterestUsd: number;
  minimumOrderbookDepthUsd: number;
  maximumSpreadBps: number;
}

export const PHASE_ONE_ELIGIBILITY_POLICY: CapitalEligibilityPolicy = {
  minimumDaysToResolution: 14,
  minimumVolumeUsd: 50_000,
  minimumOpenInterestUsd: 10_000,
  minimumOrderbookDepthUsd: 1_000,
  maximumSpreadBps: 750,
};

function unixSeconds(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  return value > 10_000_000_000 ? Math.floor(value / 1_000) : Math.floor(value);
}

function addReason(
  reasons: CapitalEligibilityReason[],
  code: CapitalEligibilityReason['code'],
  severity: CapitalEligibilityReason['severity'],
  message: string
): void {
  reasons.push({ code, severity, message });
}

export function evaluateCapitalEligibility(
  market: CapitalMarketSnapshot,
  orderbook: CapitalOrderbook | null,
  policy: CapitalEligibilityPolicy = PHASE_ONE_ELIGIBILITY_POLICY,
  now = new Date()
): CapitalEligibility {
  const reasons: CapitalEligibilityReason[] = [];
  const riskPrice = calculateCapitalRiskPrice(market, orderbook, now);
  const closeTime = unixSeconds(market.closeTime);
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const daysToResolution = closeTime === null
    ? null
    : (closeTime - nowSeconds) / 86_400;

  if (market.status !== 'active') {
    addReason(reasons, 'market_not_active', 'block', 'The market is not active.');
  }
  if (!market.account?.isInitialized) {
    addReason(reasons, 'market_not_initialized', 'block', 'The DFlow USDC market account is not initialized.');
  }
  if (market.account?.redemptionStatus !== 'open') {
    addReason(reasons, 'redemption_closed', 'block', 'Outcome-token redemption is not open.');
  }
  if (market.canCloseEarly) {
    addReason(reasons, 'early_close_allowed', 'block', 'Markets that can close early are excluded from Phase 1.');
  }
  if (!market.resolutionRules || market.resolutionRules.trim().length < 40) {
    addReason(reasons, 'resolution_rules_missing', 'warning', 'Resolution rules need manual review.');
  }
  if (daysToResolution === null) {
    addReason(reasons, 'invalid_close_time', 'block', 'The market has no valid close time.');
  } else if (daysToResolution < policy.minimumDaysToResolution) {
    addReason(
      reasons,
      'resolution_too_soon',
      'block',
      `The market closes in less than ${policy.minimumDaysToResolution} days.`
    );
  }
  if (riskPrice.bestBid === null) {
    addReason(reasons, 'executable_bid_unavailable', 'block', 'No executable bid is available for risk valuation.');
  }
  if (riskPrice.bestAsk === null) {
    addReason(reasons, 'ask_unavailable', 'warning', 'No ask is available to measure the spread.');
  }
  if (riskPrice.spreadBps !== null && riskPrice.spreadBps > policy.maximumSpreadBps) {
    addReason(
      reasons,
      'spread_too_wide',
      'block',
      `The bid/ask spread exceeds ${policy.maximumSpreadBps} bps.`
    );
  }
  if (market.volumeUsd < policy.minimumVolumeUsd) {
    addReason(reasons, 'volume_too_low', 'block', 'Market volume is below the Phase 1 minimum.');
  }
  if (market.openInterestUsd < policy.minimumOpenInterestUsd) {
    addReason(reasons, 'open_interest_too_low', 'block', 'Open interest is below the Phase 1 minimum.');
  }
  if (riskPrice.availableDepthUsd === null) {
    addReason(reasons, 'orderbook_depth_unavailable', 'warning', 'Orderbook depth is unavailable and requires review.');
  } else if (riskPrice.availableDepthUsd < policy.minimumOrderbookDepthUsd) {
    addReason(reasons, 'orderbook_depth_too_low', 'block', 'Executable orderbook depth is below the Phase 1 minimum.');
  }

  const blockCount = reasons.filter((reason) => reason.severity === 'block').length;
  const warningCount = reasons.length - blockCount;
  const score = Math.max(0, 100 - (blockCount * 25) - (warningCount * 8));
  const status = blockCount > 0 ? 'ineligible' : warningCount > 0 ? 'review' : 'eligible';

  return {
    status,
    eligible: status === 'eligible',
    score,
    daysToResolution,
    riskPrice,
    reasons,
    evaluatedAt: now.toISOString(),
  };
}
