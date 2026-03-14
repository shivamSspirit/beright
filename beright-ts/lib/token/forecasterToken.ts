/**
 * BeRight Forecaster Token Service
 *
 * Manages forecaster reputation tokens via Meteora DBC (Dynamic Bonding Curve).
 *
 * Each forecaster can create their own SPL token when they reach eligibility.
 * The token represents reputation - backers buy tokens to "bet on" the forecaster.
 *
 * DBC Benefits:
 * - Automatic price discovery based on demand
 * - No liquidity bootstrapping needed (curve provides liquidity)
 * - Fair launch mechanics (no pre-mine)
 * - Revenue for forecaster from curve fees
 *
 * Curve Types:
 * - Linear: price = initial + (slope × supply)
 * - Exponential: price = initial × (1 + rate)^supply
 * - Sigmoid: S-curve with max cap
 * - Sqrt: price = initial × sqrt(supply)
 *
 * @author BeRight Protocol
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PublicKey, Connection, Keypair, Transaction } from '@solana/web3.js';
import { BN } from 'bn.js';
import type {
  ForecasterToken,
  BondingCurveType,
  CreateTokenRequest,
  TokenHolder,
} from '@/types/forecaster';

// =============================================================================
// CONSTANTS
// =============================================================================

// Default curve parameters
export const DEFAULT_CURVE_TYPE: BondingCurveType = 'linear';
export const DEFAULT_INITIAL_PRICE = 0.01; // $0.01 USDC
export const DEFAULT_SLOPE = 0.000001; // Price increase per token
export const DEFAULT_MAX_SUPPLY = '1000000000000'; // 1M tokens (6 decimals)
export const DEFAULT_BUY_FEE_BPS = 100; // 1%
export const DEFAULT_SELL_FEE_BPS = 100; // 1%
export const DEFAULT_FORECASTER_FEE_BPS = 5000; // 50% of fees to forecaster

// USDC mint on mainnet
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const USDC_DECIMALS = 6;

// Token decimals
export const TOKEN_DECIMALS = 6;

// =============================================================================
// TYPES
// =============================================================================

interface TokenCreateResult {
  success: boolean;
  token?: ForecasterToken;
  mint?: string;
  curveAddress?: string;
  txSignature?: string;
  error?: string;
}

interface TokenBuyResult {
  success: boolean;
  tokensReceived: string;
  pricePerToken: number;
  totalCost: number;
  fee: number;
  txSignature?: string;
  error?: string;
}

interface TokenSellResult {
  success: boolean;
  usdcReceived: string;
  pricePerToken: number;
  fee: number;
  txSignature?: string;
  error?: string;
}

interface CurveQuote {
  tokensOut: string;
  pricePerToken: number;
  totalCost: number;
  fee: number;
  priceImpact: number;
  newPrice: number;
}

// =============================================================================
// BONDING CURVE MATH
// =============================================================================

/**
 * Calculate token price based on curve type and current supply
 */
export function calculatePrice(
  curveType: BondingCurveType,
  initialPrice: number,
  slope: number,
  currentSupply: number
): number {
  switch (curveType) {
    case 'linear':
      // price = initial + (slope × supply)
      return initialPrice + slope * currentSupply;

    case 'exponential':
      // price = initial × (1 + slope)^(supply/scale)
      const scale = 1000000; // Scale factor for smoother curve
      return initialPrice * Math.pow(1 + slope, currentSupply / scale);

    case 'sigmoid':
      // S-curve: price = initial + (max - initial) × (1 / (1 + e^(-k(x-mid))))
      const maxPrice = initialPrice * 100; // 100x max
      const midpoint = 500000; // Midpoint at 500k tokens
      const steepness = 0.00001;
      const sigmoid = 1 / (1 + Math.exp(-steepness * (currentSupply - midpoint)));
      return initialPrice + (maxPrice - initialPrice) * sigmoid;

    case 'sqrt':
      // price = initial × sqrt(1 + supply/scale)
      const sqrtScale = 1000000;
      return initialPrice * Math.sqrt(1 + currentSupply / sqrtScale);

    default:
      return initialPrice;
  }
}

/**
 * Calculate cost to buy tokens
 */
export function calculateBuyCost(
  curveType: BondingCurveType,
  initialPrice: number,
  slope: number,
  currentSupply: number,
  tokensToBuy: number,
  buyFeeBps: number
): CurveQuote {
  // Integrate price curve from currentSupply to currentSupply + tokensToBuy
  let totalCost = 0;
  const steps = 100; // Integration steps
  const stepSize = tokensToBuy / steps;

  for (let i = 0; i < steps; i++) {
    const supply = currentSupply + i * stepSize;
    const price = calculatePrice(curveType, initialPrice, slope, supply);
    totalCost += price * stepSize;
  }

  const fee = (totalCost * buyFeeBps) / 10000;
  const totalWithFee = totalCost + fee;

  const startPrice = calculatePrice(curveType, initialPrice, slope, currentSupply);
  const endPrice = calculatePrice(curveType, initialPrice, slope, currentSupply + tokensToBuy);
  const avgPrice = totalCost / tokensToBuy;
  const priceImpact = ((endPrice - startPrice) / startPrice) * 100;

  return {
    tokensOut: Math.floor(tokensToBuy * Math.pow(10, TOKEN_DECIMALS)).toString(),
    pricePerToken: avgPrice,
    totalCost: totalWithFee,
    fee,
    priceImpact,
    newPrice: endPrice,
  };
}

/**
 * Calculate tokens received for USDC amount
 */
export function calculateTokensForUsdc(
  curveType: BondingCurveType,
  initialPrice: number,
  slope: number,
  currentSupply: number,
  usdcAmount: number,
  buyFeeBps: number
): CurveQuote {
  // Binary search to find token amount
  let low = 0;
  let high = usdcAmount / initialPrice * 2; // Upper bound estimate
  let tokensToBuy = 0;

  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    const quote = calculateBuyCost(curveType, initialPrice, slope, currentSupply, mid, buyFeeBps);

    if (Math.abs(quote.totalCost - usdcAmount) < 0.01) {
      tokensToBuy = mid;
      break;
    }

    if (quote.totalCost > usdcAmount) {
      high = mid;
    } else {
      low = mid;
      tokensToBuy = mid;
    }
  }

  return calculateBuyCost(curveType, initialPrice, slope, currentSupply, tokensToBuy, buyFeeBps);
}

/**
 * Calculate USDC received for selling tokens
 */
export function calculateSellReturn(
  curveType: BondingCurveType,
  initialPrice: number,
  slope: number,
  currentSupply: number,
  tokensToSell: number,
  sellFeeBps: number
): { usdcOut: number; fee: number; newPrice: number; priceImpact: number } {
  // Integrate price curve from currentSupply - tokensToSell to currentSupply
  let totalReturn = 0;
  const steps = 100;
  const stepSize = tokensToSell / steps;

  for (let i = 0; i < steps; i++) {
    const supply = currentSupply - i * stepSize;
    const price = calculatePrice(curveType, initialPrice, slope, supply);
    totalReturn += price * stepSize;
  }

  const fee = (totalReturn * sellFeeBps) / 10000;
  const usdcOut = totalReturn - fee;

  const startPrice = calculatePrice(curveType, initialPrice, slope, currentSupply);
  const endPrice = calculatePrice(curveType, initialPrice, slope, currentSupply - tokensToSell);
  const priceImpact = ((startPrice - endPrice) / startPrice) * 100;

  return {
    usdcOut,
    fee,
    newPrice: endPrice,
    priceImpact,
  };
}

// =============================================================================
// FORECASTER TOKEN SERVICE
// =============================================================================

export class ForecasterTokenService {
  private supabase: SupabaseClient;
  private connection: Connection;

  constructor(supabaseUrl: string, supabaseKey: string, rpcUrl: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
    this.connection = new Connection(rpcUrl, 'confirmed');
  }

  // ===========================================================================
  // TOKEN CREATION
  // ===========================================================================

  /**
   * Create a new forecaster token via Meteora DBC
   */
  async createToken(request: CreateTokenRequest): Promise<TokenCreateResult> {
    try {
      // Verify forecaster exists and is eligible
      const { data: forecaster, error: forecasterError } = await this.supabase
        .from('forecaster_profiles')
        .select('*')
        .eq('pubkey', request.forecasterPubkey)
        .single();

      if (forecasterError || !forecaster) {
        return { success: false, error: 'Forecaster not found' };
      }

      // Check eligibility (must be verified tier or above)
      if (!['verified', 'elite', 'superforecaster'].includes(forecaster.tier)) {
        return {
          success: false,
          error: 'Must be verified tier or above to create token',
        };
      }

      // Check if already has token
      if (forecaster.token_mint) {
        return {
          success: false,
          error: 'Forecaster already has a token',
        };
      }

      // Validate symbol (3-5 uppercase chars)
      if (!/^[A-Z]{3,5}$/.test(request.symbol)) {
        return {
          success: false,
          error: 'Symbol must be 3-5 uppercase letters',
        };
      }

      // Create Meteora DBC pool (placeholder - actual implementation uses Meteora SDK)
      const meteoraResult = await this.createMeteoraDbc(request);
      if (!meteoraResult.success) {
        return {
          success: false,
          error: `Failed to create DBC: ${meteoraResult.error}`,
        };
      }

      // Store token in database
      const token: Partial<ForecasterToken> = {
        mint: meteoraResult.mint!,
        symbol: request.symbol,
        name: request.name,
        decimals: TOKEN_DECIMALS,
        uri: null,
        bondingCurve: {
          address: meteoraResult.curveAddress!,
          curveType: request.curveType || DEFAULT_CURVE_TYPE,
          baseToken: USDC_MINT.toBase58(),
          initialPrice: request.initialPrice || DEFAULT_INITIAL_PRICE,
          slope: request.slope || DEFAULT_SLOPE,
          maxSupply: request.maxSupply || DEFAULT_MAX_SUPPLY,
          reserveBalance: '0',
          buyFeeBps: request.buyFeeBps || DEFAULT_BUY_FEE_BPS,
          sellFeeBps: request.sellFeeBps || DEFAULT_SELL_FEE_BPS,
          forecasterFeeBps: DEFAULT_FORECASTER_FEE_BPS,
        },
        totalSupply: '0',
        circulatingSupply: '0',
        forecasterHolding: '0',
        lockedUntil: null,
        currentPrice: request.initialPrice || DEFAULT_INITIAL_PRICE,
        priceChange24h: null,
        volume24h: null,
        marketCapUsd: null,
        feesEarned24h: null,
        totalFeesEarned: null,
        holderCount: 0,
        topHolders: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { error: insertError } = await this.supabase
        .from('forecaster_tokens')
        .insert({
          forecaster_pubkey: request.forecasterPubkey,
          mint: token.mint,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          curve_address: token.bondingCurve!.address,
          curve_type: token.bondingCurve!.curveType,
          base_token: token.bondingCurve!.baseToken,
          initial_price: token.bondingCurve!.initialPrice,
          slope: token.bondingCurve!.slope,
          max_supply: token.bondingCurve!.maxSupply,
          buy_fee_bps: token.bondingCurve!.buyFeeBps,
          sell_fee_bps: token.bondingCurve!.sellFeeBps,
          forecaster_fee_bps: token.bondingCurve!.forecasterFeeBps,
          current_price: token.currentPrice,
          created_at: token.createdAt,
        });

      if (insertError) {
        return {
          success: false,
          error: `Failed to store token: ${insertError.message}`,
        };
      }

      // Update forecaster profile with token mint
      await this.supabase
        .from('forecaster_profiles')
        .update({
          token_mint: token.mint,
          token_created_at: new Date().toISOString(),
        })
        .eq('pubkey', request.forecasterPubkey);

      return {
        success: true,
        token: token as ForecasterToken,
        mint: token.mint,
        curveAddress: token.bondingCurve!.address,
        txSignature: meteoraResult.txSignature,
      };
    } catch (error) {
      console.error('[TokenService] Create error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create Meteora DBC pool (placeholder)
   */
  private async createMeteoraDbc(
    request: CreateTokenRequest
  ): Promise<{
    success: boolean;
    mint?: string;
    curveAddress?: string;
    txSignature?: string;
    error?: string;
  }> {
    // TODO: Implement actual Meteora SDK integration
    // For now, return mock data
    console.log('[TokenService] Creating Meteora DBC (mock):', request.symbol);

    const mockMint = `${request.symbol}${Date.now()}`;
    const mockCurve = `curve_${Date.now()}`;

    return {
      success: true,
      mint: mockMint,
      curveAddress: mockCurve,
      txSignature: `sig_${Date.now()}`,
    };
  }

  // ===========================================================================
  // TOKEN TRADING
  // ===========================================================================

  /**
   * Buy forecaster tokens
   */
  async buyTokens(
    tokenMint: string,
    buyerPubkey: string,
    usdcAmount: number
  ): Promise<TokenBuyResult> {
    try {
      // Get token info
      const { data: token, error: tokenError } = await this.supabase
        .from('forecaster_tokens')
        .select('*')
        .eq('mint', tokenMint)
        .single();

      if (tokenError || !token) {
        return { success: false, error: 'Token not found', tokensReceived: '0', pricePerToken: 0, totalCost: 0, fee: 0 };
      }

      // Calculate quote
      const currentSupply = parseFloat(token.total_supply) / Math.pow(10, TOKEN_DECIMALS);
      const quote = calculateTokensForUsdc(
        token.curve_type,
        token.initial_price,
        token.slope,
        currentSupply,
        usdcAmount,
        token.buy_fee_bps
      );

      // Execute on-chain buy (placeholder)
      const txSignature = await this.executeBuy(tokenMint, buyerPubkey, usdcAmount);

      // Update token state
      const newSupply = BigInt(token.total_supply) + BigInt(quote.tokensOut);
      const forecasterFee = (quote.fee * token.forecaster_fee_bps) / 10000;

      await this.supabase
        .from('forecaster_tokens')
        .update({
          total_supply: newSupply.toString(),
          circulating_supply: newSupply.toString(),
          current_price: quote.newPrice,
          reserve_balance: (parseFloat(token.reserve_balance) + usdcAmount - quote.fee).toString(),
          volume_24h: (token.volume_24h || 0) + usdcAmount,
          total_fees_earned: (token.total_fees_earned || 0) + quote.fee,
          fees_earned_24h: (token.fees_earned_24h || 0) + quote.fee,
          updated_at: new Date().toISOString(),
        })
        .eq('mint', tokenMint);

      // Update or create holder record
      await this.updateHolderBalance(tokenMint, buyerPubkey, quote.tokensOut, quote.pricePerToken, 'buy');

      // Update forecaster fees earned
      await this.supabase
        .from('forecaster_profiles')
        .update({
          total_fees_earned_usd: token.forecaster_pubkey ?
            (await this.getForecasterFees(token.forecaster_pubkey)) + forecasterFee : forecasterFee,
        })
        .eq('token_mint', tokenMint);

      return {
        success: true,
        tokensReceived: quote.tokensOut,
        pricePerToken: quote.pricePerToken,
        totalCost: quote.totalCost,
        fee: quote.fee,
        txSignature,
      };
    } catch (error) {
      console.error('[TokenService] Buy error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        tokensReceived: '0',
        pricePerToken: 0,
        totalCost: 0,
        fee: 0,
      };
    }
  }

  /**
   * Sell forecaster tokens
   */
  async sellTokens(
    tokenMint: string,
    sellerPubkey: string,
    tokenAmount: string
  ): Promise<TokenSellResult> {
    try {
      // Get token info
      const { data: token, error: tokenError } = await this.supabase
        .from('forecaster_tokens')
        .select('*')
        .eq('mint', tokenMint)
        .single();

      if (tokenError || !token) {
        return { success: false, error: 'Token not found', usdcReceived: '0', pricePerToken: 0, fee: 0 };
      }

      // Check seller has enough balance
      const { data: holding } = await this.supabase
        .from('token_holdings')
        .select('balance')
        .eq('token_mint', tokenMint)
        .eq('wallet', sellerPubkey)
        .single();

      if (!holding || BigInt(holding.balance) < BigInt(tokenAmount)) {
        return { success: false, error: 'Insufficient balance', usdcReceived: '0', pricePerToken: 0, fee: 0 };
      }

      // Calculate return
      const currentSupply = parseFloat(token.total_supply) / Math.pow(10, TOKEN_DECIMALS);
      const tokensToSell = parseFloat(tokenAmount) / Math.pow(10, TOKEN_DECIMALS);
      const sellResult = calculateSellReturn(
        token.curve_type,
        token.initial_price,
        token.slope,
        currentSupply,
        tokensToSell,
        token.sell_fee_bps
      );

      // Execute on-chain sell (placeholder)
      const txSignature = await this.executeSell(tokenMint, sellerPubkey, tokenAmount);

      // Update token state
      const newSupply = BigInt(token.total_supply) - BigInt(tokenAmount);

      await this.supabase
        .from('forecaster_tokens')
        .update({
          total_supply: newSupply.toString(),
          circulating_supply: newSupply.toString(),
          current_price: sellResult.newPrice,
          reserve_balance: (parseFloat(token.reserve_balance) - sellResult.usdcOut - sellResult.fee).toString(),
          volume_24h: (token.volume_24h || 0) + sellResult.usdcOut,
          total_fees_earned: (token.total_fees_earned || 0) + sellResult.fee,
          fees_earned_24h: (token.fees_earned_24h || 0) + sellResult.fee,
          updated_at: new Date().toISOString(),
        })
        .eq('mint', tokenMint);

      // Update holder balance
      await this.updateHolderBalance(tokenMint, sellerPubkey, `-${tokenAmount}`, sellResult.usdcOut / tokensToSell, 'sell');

      return {
        success: true,
        usdcReceived: sellResult.usdcOut.toString(),
        pricePerToken: sellResult.usdcOut / tokensToSell,
        fee: sellResult.fee,
        txSignature,
      };
    } catch (error) {
      console.error('[TokenService] Sell error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        usdcReceived: '0',
        pricePerToken: 0,
        fee: 0,
      };
    }
  }

  /**
   * Execute on-chain buy (placeholder)
   */
  private async executeBuy(
    tokenMint: string,
    buyerPubkey: string,
    usdcAmount: number
  ): Promise<string> {
    console.log('[TokenService] Executing buy (mock):', { tokenMint, buyerPubkey, usdcAmount });
    return `buy_sig_${Date.now()}`;
  }

  /**
   * Execute on-chain sell (placeholder)
   */
  private async executeSell(
    tokenMint: string,
    sellerPubkey: string,
    tokenAmount: string
  ): Promise<string> {
    console.log('[TokenService] Executing sell (mock):', { tokenMint, sellerPubkey, tokenAmount });
    return `sell_sig_${Date.now()}`;
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Update holder balance
   */
  private async updateHolderBalance(
    tokenMint: string,
    wallet: string,
    amount: string,
    price: number,
    action: 'buy' | 'sell'
  ): Promise<void> {
    const { data: existing } = await this.supabase
      .from('token_holdings')
      .select('*')
      .eq('token_mint', tokenMint)
      .eq('wallet', wallet)
      .single();

    if (existing) {
      const currentBalance = BigInt(existing.balance);
      const changeAmount = BigInt(amount.startsWith('-') ? amount.slice(1) : amount);
      const newBalance = action === 'buy'
        ? currentBalance + changeAmount
        : currentBalance - changeAmount;

      // Calculate new average entry price for buys
      let newAvgPrice = existing.avg_entry_price;
      if (action === 'buy') {
        const totalValue = parseFloat(existing.balance) * existing.avg_entry_price +
          parseFloat(amount) * price;
        newAvgPrice = totalValue / parseFloat(newBalance.toString());
      }

      await this.supabase
        .from('token_holdings')
        .update({
          balance: newBalance.toString(),
          avg_entry_price: newAvgPrice,
          total_bought: action === 'buy'
            ? (BigInt(existing.total_bought) + changeAmount).toString()
            : existing.total_bought,
          total_sold: action === 'sell'
            ? (BigInt(existing.total_sold) + changeAmount).toString()
            : existing.total_sold,
          last_activity_at: new Date().toISOString(),
        })
        .eq('token_mint', tokenMint)
        .eq('wallet', wallet);

      // Delete if balance is zero
      if (newBalance <= 0n) {
        await this.supabase
          .from('token_holdings')
          .delete()
          .eq('token_mint', tokenMint)
          .eq('wallet', wallet);
      }
    } else if (action === 'buy') {
      // Create new holding
      await this.supabase.from('token_holdings').insert({
        token_mint: tokenMint,
        wallet,
        balance: amount,
        avg_entry_price: price,
        total_bought: amount,
        total_sold: '0',
        first_buy_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      });

      // Update holder count
      const { count } = await this.supabase
        .from('token_holdings')
        .select('*', { count: 'exact', head: true })
        .eq('token_mint', tokenMint);

      await this.supabase
        .from('forecaster_tokens')
        .update({ holder_count: count || 1 })
        .eq('mint', tokenMint);
    }
  }

  /**
   * Get forecaster total fees earned
   */
  private async getForecasterFees(forecasterPubkey: string): Promise<number> {
    const { data } = await this.supabase
      .from('forecaster_profiles')
      .select('total_fees_earned_usd')
      .eq('pubkey', forecasterPubkey)
      .single();

    return data?.total_fees_earned_usd || 0;
  }

  // ===========================================================================
  // QUERIES
  // ===========================================================================

  /**
   * Get token by mint
   */
  async getToken(mint: string): Promise<ForecasterToken | null> {
    const { data, error } = await this.supabase
      .from('forecaster_tokens')
      .select('*')
      .eq('mint', mint)
      .single();

    if (error || !data) return null;
    return this.mapDbToToken(data);
  }

  /**
   * Get token by forecaster
   */
  async getForecasterToken(forecasterPubkey: string): Promise<ForecasterToken | null> {
    const { data, error } = await this.supabase
      .from('forecaster_tokens')
      .select('*')
      .eq('forecaster_pubkey', forecasterPubkey)
      .single();

    if (error || !data) return null;
    return this.mapDbToToken(data);
  }

  /**
   * Get top holders
   */
  async getTopHolders(mint: string, limit: number = 10): Promise<TokenHolder[]> {
    const { data, error } = await this.supabase
      .from('token_holdings')
      .select('wallet, balance')
      .eq('token_mint', mint)
      .order('balance', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    const { data: token } = await this.supabase
      .from('forecaster_tokens')
      .select('total_supply')
      .eq('mint', mint)
      .single();

    const totalSupply = BigInt(token?.total_supply || '1');

    return data.map((row) => ({
      wallet: row.wallet,
      balance: row.balance,
      percentage: Number((BigInt(row.balance) * BigInt(10000)) / totalSupply) / 100,
    }));
  }

  /**
   * Get buy quote
   */
  async getBuyQuote(mint: string, usdcAmount: number): Promise<CurveQuote | null> {
    const { data: token } = await this.supabase
      .from('forecaster_tokens')
      .select('*')
      .eq('mint', mint)
      .single();

    if (!token) return null;

    const currentSupply = parseFloat(token.total_supply) / Math.pow(10, TOKEN_DECIMALS);
    return calculateTokensForUsdc(
      token.curve_type,
      token.initial_price,
      token.slope,
      currentSupply,
      usdcAmount,
      token.buy_fee_bps
    );
  }

  /**
   * Map database row to ForecasterToken
   */
  private mapDbToToken(row: any): ForecasterToken {
    return {
      mint: row.mint,
      symbol: row.symbol,
      name: row.name,
      decimals: row.decimals,
      uri: row.uri,
      bondingCurve: {
        address: row.curve_address,
        curveType: row.curve_type,
        baseToken: row.base_token,
        initialPrice: row.initial_price,
        slope: row.slope,
        maxSupply: row.max_supply,
        reserveBalance: row.reserve_balance || '0',
        buyFeeBps: row.buy_fee_bps,
        sellFeeBps: row.sell_fee_bps,
        forecasterFeeBps: row.forecaster_fee_bps,
      },
      totalSupply: row.total_supply || '0',
      circulatingSupply: row.circulating_supply || '0',
      forecasterHolding: row.forecaster_holding || '0',
      lockedUntil: row.locked_until,
      currentPrice: row.current_price,
      priceChange24h: row.price_change_24h,
      volume24h: row.volume_24h,
      marketCapUsd: row.market_cap_usd,
      feesEarned24h: row.fees_earned_24h,
      totalFeesEarned: row.total_fees_earned,
      holderCount: row.holder_count || 0,
      topHolders: [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let instance: ForecasterTokenService | null = null;

export function getForecasterTokenService(): ForecasterTokenService {
  if (!instance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    instance = new ForecasterTokenService(supabaseUrl, supabaseKey, rpcUrl);
  }

  return instance;
}

export default ForecasterTokenService;
