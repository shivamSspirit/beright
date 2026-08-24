import type { CapitalSimulation, CapitalSimulationInput } from './types';

const BPS_DENOMINATOR = 10_000;
const DAYS_PER_YEAR = 365;
const USER_YIELD_SHARE = 0.5;

function requireFiniteRange(name: string, value: number, minimum: number, maximum: number): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }
}

function roundUsd(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function simulateMatchedPairYield(input: CapitalSimulationInput): CapitalSimulation {
  const reserveBps = input.reserveBps ?? 2_000;
  const protocolFeeBps = input.protocolFeeBps ?? 0;

  requireFiniteRange('shares', input.shares, 0.000001, 1_000_000_000);
  requireFiniteRange('opposingAvailableShares', input.opposingAvailableShares, 0, 1_000_000_000);
  requireFiniteRange('holdingDays', input.holdingDays, 1, 365);
  requireFiniteRange('strategyApyPct', input.strategyApyPct, 0, 100);
  requireFiniteRange('executableBid', input.executableBid, 0.000001, 0.999999);
  requireFiniteRange('reserveBps', reserveBps, 0, 5_000);
  requireFiniteRange('protocolFeeBps', protocolFeeBps, 0, 2_000);

  const matchedShares = Math.min(input.shares, input.opposingAvailableShares);
  const unmatchedShares = input.shares - matchedShares;
  const matchedPairPrincipalUsd = matchedShares;
  const reserveUsd = matchedPairPrincipalUsd * (reserveBps / BPS_DENOMINATOR);
  const deployedPrincipalUsd = matchedPairPrincipalUsd - reserveUsd;
  const annualRate = input.strategyApyPct / 100;
  const timeFraction = input.holdingDays / DAYS_PER_YEAR;
  const estimatedGrossStrategyYieldUsd = deployedPrincipalUsd * annualRate * timeFraction;
  const estimatedGrossUserYieldUsd = estimatedGrossStrategyYieldUsd * USER_YIELD_SHARE;
  const estimatedProtocolFeeUsd = estimatedGrossUserYieldUsd * (protocolFeeBps / BPS_DENOMINATOR);
  const estimatedNetUserYieldUsd = estimatedGrossUserYieldUsd - estimatedProtocolFeeUsd;
  const positionValueUsd = input.shares * input.executableBid;
  const estimatedEffectiveApyPct = positionValueUsd === 0
    ? 0
    : (estimatedNetUserYieldUsd / positionValueUsd) * (DAYS_PER_YEAR / input.holdingDays) * 100;

  return {
    positionValueUsd: roundUsd(positionValueUsd),
    matchedShares: roundUsd(matchedShares),
    unmatchedShares: roundUsd(unmatchedShares),
    matchedPairPrincipalUsd: roundUsd(matchedPairPrincipalUsd),
    deployedPrincipalUsd: roundUsd(deployedPrincipalUsd),
    reserveUsd: roundUsd(reserveUsd),
    estimatedGrossStrategyYieldUsd: roundUsd(estimatedGrossStrategyYieldUsd),
    estimatedGrossUserYieldUsd: roundUsd(estimatedGrossUserYieldUsd),
    estimatedProtocolFeeUsd: roundUsd(estimatedProtocolFeeUsd),
    estimatedNetUserYieldUsd: roundUsd(estimatedNetUserYieldUsd),
    estimatedYieldRangeUsd: {
      low: roundUsd(estimatedNetUserYieldUsd * 0.8),
      high: roundUsd(estimatedNetUserYieldUsd * 1.2),
    },
    estimatedEffectiveApyPct: roundUsd(estimatedEffectiveApyPct),
    assumptions: {
      userYieldSharePct: 50,
      reserveBps,
      protocolFeeBps,
      holdingDays: input.holdingDays,
      strategyApyPct: input.strategyApyPct,
    },
  };
}
