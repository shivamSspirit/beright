import { Connection, PublicKey } from '@solana/web3.js';
import { NextRequest, NextResponse } from 'next/server';
import {
  evaluateCapitalEligibility,
  getCapitalDemoMarket,
  getCapitalMarketSnapshot,
  type CapitalSide,
} from '../../../../../../lib/capital';
import { getPositions } from '../../../../../../lib/dflow/positions';
import { isDemoRequest } from '../../../../../../lib/mode';

interface RouteContext {
  params: Promise<{ wallet: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { wallet } = await context.params;
  try {
    new PublicKey(wallet);
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid Solana wallet address.' }, { status: 400 });
  }

  const demoMode = isDemoRequest(request);
  if (demoMode) {
    const shares = 425;
    const snapshot = getCapitalDemoMarket('YES');
    const eligibility = evaluateCapitalEligibility(snapshot.market, snapshot.orderbook);
    return NextResponse.json({
      success: true,
      data: [{
        market: snapshot.market,
        mintAddress: snapshot.market.account?.yesMint,
        shares,
        positionValueUsd: shares * (eligibility.riskPrice.price ?? 0),
        eligibility,
      }],
      meta: { mode: 'demo', custody: false, executable: false },
    });
  }

  const rpcUrl = process.env.HELIUS_RPC_MAINNET
    || process.env.SOLANA_RPC_URL
    || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpcUrl, 'confirmed');

  try {
    const positions = await getPositions(connection, wallet);
    const evaluated = await Promise.all(positions.slice(0, 25).map(async (position) => {
      const side = position.side as CapitalSide;
      const snapshot = await getCapitalMarketSnapshot(position.marketTicker, side);
      if (!snapshot) {
        return {
          marketTicker: position.marketTicker,
          title: position.title,
          side,
          mintAddress: position.mintAddress,
          shares: position.shares,
          available: false,
          reason: 'Fresh market or orderbook data is unavailable.',
        };
      }

      const eligibility = evaluateCapitalEligibility(snapshot.market, snapshot.orderbook);
      return {
        market: snapshot.market,
        mintAddress: position.mintAddress,
        shares: position.shares,
        positionValueUsd: eligibility.riskPrice.price === null
          ? null
          : position.shares * eligibility.riskPrice.price,
        eligibility,
        available: true,
      };
    }));

    return NextResponse.json({
      success: true,
      data: evaluated,
      meta: {
        mode: 'production',
        custody: false,
        executable: false,
        valuation: 'executable_bid_only',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to read wallet positions.';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
