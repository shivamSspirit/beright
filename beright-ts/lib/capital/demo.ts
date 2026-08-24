import type { CapitalMarketSnapshot, CapitalOrderbook, CapitalSide } from './types';

export const CAPITAL_DEMO_TICKER = 'BERIGHT-AI-2027';

export function getCapitalDemoMarket(
  side: CapitalSide,
  now = new Date()
): { market: CapitalMarketSnapshot; orderbook: CapitalOrderbook } {
  const yesBid = 0.61;
  const yesAsk = 0.63;
  const noBid = 0.37;
  const noAsk = 0.39;
  const closeTime = Math.floor(now.getTime() / 1_000) + (120 * 86_400);

  return {
    market: {
      ticker: CAPITAL_DEMO_TICKER,
      eventTicker: 'BERIGHT-AI',
      title: 'Will a leading AI benchmark be surpassed before 2027?',
      status: 'active',
      side,
      bid: side === 'YES' ? yesBid : noBid,
      ask: side === 'YES' ? yesAsk : noAsk,
      volumeUsd: 785_000,
      openInterestUsd: 164_000,
      closeTime,
      expirationTime: closeTime + (7 * 86_400),
      canCloseEarly: false,
      resolutionRules: 'Resolves YES if the named public benchmark records a qualifying result before the stated deadline, using the benchmark operator as the primary source.',
      account: {
        marketLedger: 'CapitalDemoMarketLedger111111111111111111111',
        yesMint: 'CapitalDemoYesMint11111111111111111111111111',
        noMint: 'CapitalDemoNoMint111111111111111111111111111',
        isInitialized: true,
        redemptionStatus: 'open',
      },
    },
    orderbook: {
      yesBids: { '0.61': 9_000, '0.60': 12_500, '0.59': 18_000 },
      yesAsks: { '0.63': 7_500, '0.64': 11_000 },
      noBids: { '0.37': 7_500, '0.36': 11_000, '0.35': 14_000 },
      noAsks: { '0.39': 9_000, '0.40': 12_500 },
    },
  };
}
