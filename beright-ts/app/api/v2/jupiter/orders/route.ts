/**
 * Jupiter Prediction Orders API
 *
 * GET /api/v2/jupiter/orders?wallet=<pubkey> - Get user orders
 * POST /api/v2/jupiter/orders - Create order (returns unsigned tx)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  getOrders,
  getOrderStatus,
  cancelOrder,
  getMarket,
  microUsdToUsd,
  PLATFORM_FEE_CONFIG,
} from '../../../../../lib/jupiter/prediction';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletPubkey = searchParams.get('wallet');
    const orderPubkey = searchParams.get('orderId');

    // Get single order status
    if (orderPubkey) {
      const response = await getOrderStatus(orderPubkey);

      if (!response.success) {
        return NextResponse.json(
          { success: false, error: response.error || 'Order not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: response.data });
    }

    // Get orders for wallet
    if (!walletPubkey) {
      return NextResponse.json(
        { success: false, error: 'wallet or orderId parameter is required' },
        { status: 400 }
      );
    }

    const status = searchParams.get('status') as 'open' | 'filled' | 'all' | undefined;
    const limit = parseInt(searchParams.get('limit') || '50');

    const response = await getOrders(walletPubkey, { status, limit });

    if (!response.success) {
      return NextResponse.json(
        { success: false, error: response.error || 'Failed to fetch orders' },
        { status: 500 }
      );
    }

    // Format orders
    const orders = (response.data || []).map(o => ({
      orderPubkey: o.orderPubkey,
      marketId: o.marketId,
      side: o.side,
      contracts: parseInt(o.contracts),
      priceUsd: microUsdToUsd(o.priceUsd),
      filledContracts: parseInt(o.filledContracts),
      status: o.status,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        wallet: walletPubkey,
        orders,
        openCount: orders.filter(o => o.status === 'open' || o.status === 'partially_filled').length,
      },
    });
  } catch (error) {
    console.error('[Jupiter Orders API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, marketId, side, amountUsd, walletPubkey, maxPriceUsd, orderPubkey } = body;

    // Cancel order
    if (action === 'cancel') {
      if (!orderPubkey || !walletPubkey) {
        return NextResponse.json(
          { success: false, error: 'orderPubkey and walletPubkey are required for cancel' },
          { status: 400 }
        );
      }

      const response = await cancelOrder(orderPubkey, walletPubkey);

      if (!response.success || !response.data) {
        return NextResponse.json(
          { success: false, error: response.error || 'Failed to create cancel transaction' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          action: 'cancel',
          orderPubkey,
          transaction: response.data.transaction,
          txMeta: response.data.txMeta,
        },
      });
    }

    // Create order
    if (!marketId) {
      return NextResponse.json(
        { success: false, error: 'marketId is required' },
        { status: 400 }
      );
    }

    if (!side || !['YES', 'NO'].includes(side.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'side must be YES or NO' },
        { status: 400 }
      );
    }

    if (!amountUsd || amountUsd <= 0) {
      return NextResponse.json(
        { success: false, error: 'amountUsd must be positive' },
        { status: 400 }
      );
    }

    if (!walletPubkey) {
      return NextResponse.json(
        { success: false, error: 'walletPubkey is required' },
        { status: 400 }
      );
    }

    // Get market info first
    const marketResponse = await getMarket(marketId);
    if (!marketResponse.success || !marketResponse.data) {
      return NextResponse.json(
        { success: false, error: 'Market not found' },
        { status: 404 }
      );
    }

    const market = marketResponse.data;

    // Create order
    const orderResponse = await createOrder({
      marketId,
      side: side.toUpperCase() as 'YES' | 'NO',
      amountUsd: parseFloat(amountUsd),
      maxPriceUsd: maxPriceUsd ? parseFloat(maxPriceUsd) : undefined,
      userPubkey: walletPubkey,
    });

    if (!orderResponse.success || !orderResponse.data) {
      return NextResponse.json(
        { success: false, error: orderResponse.error || 'Failed to create order' },
        { status: 500 }
      );
    }

    const order = orderResponse.data;

    // Calculate platform fee if enabled
    const platformFee = PLATFORM_FEE_CONFIG.enabled && PLATFORM_FEE_CONFIG.referralAccount
      ? {
          enabled: true,
          referralAccount: PLATFORM_FEE_CONFIG.referralAccount,
          feeBps: PLATFORM_FEE_CONFIG.feeBps,
          feePercent: `${(PLATFORM_FEE_CONFIG.feeBps / 100).toFixed(2)}%`,
          estimatedFeeUsd: (parseFloat(amountUsd) * PLATFORM_FEE_CONFIG.feeBps / 10000).toFixed(4),
        }
      : { enabled: false };

    return NextResponse.json({
      success: true,
      data: {
        action: 'create',
        market: {
          marketId,
          title: market.title,
          provider: market.provider,
        },
        order: {
          orderPubkey: order.order.orderPubkey,
          positionPubkey: order.order.positionPubkey,
          side: side.toUpperCase(),
          amountUsd,
          contracts: parseInt(order.order.contracts),
          pricePerContractUsd: microUsdToUsd(order.order.pricePerContractUsd),
          totalCostUsd: microUsdToUsd(order.order.totalCostUsd),
        },
        platformFee, // BeRight revenue info
        transaction: order.transaction,
        txMeta: order.txMeta,
        warning: order.warning,
        note: 'Sign this transaction with your Solana wallet to execute the order.',
      },
    });
  } catch (error) {
    console.error('[Jupiter Orders API] POST Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// Disable caching for real-time data
export const dynamic = 'force-dynamic';
