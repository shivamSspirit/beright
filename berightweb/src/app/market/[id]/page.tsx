'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUnifiedUser';
import {
  JupiterEvent,
  getJupiterEvent,
  getJupiterHotEvents,
} from '@/lib/api';
import TradingModal from '@/components/TradingModal';
import type { DFlowData } from '@/lib/types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatVolume(volume: number): string {
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${Math.round(volume / 1_000)}K`;
  return `$${Math.round(volume)}`;
}

function formatDate(dateStr: string | number | null): string {
  if (!dateStr) return 'TBD';
  const date = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeRemaining(dateStr: string | number | null): string {
  if (!dateStr) return 'Open';
  const date = typeof dateStr === 'number' ? new Date(dateStr * 1000) : new Date(dateStr);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();

  if (diffMs <= 0) return 'Ended';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 30) return `${Math.floor(days / 30)} months`;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return '<1h';
}

function categorizeMarket(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('bitcoin') || lower.includes('btc') || lower.includes('eth') || lower.includes('crypto') || lower.includes('solana')) return 'Crypto';
  if (lower.includes('trump') || lower.includes('biden') || lower.includes('election') || lower.includes('president') || lower.includes('congress')) return 'Politics';
  if (lower.includes('fed') || lower.includes('rate') || lower.includes('inflation') || lower.includes('recession') || lower.includes('tariff')) return 'Economics';
  if (lower.includes('ai') || lower.includes('spacex') || lower.includes('tesla') || lower.includes('gpt')) return 'Tech';
  if (lower.includes('nba') || lower.includes('nfl') || lower.includes('championship') || lower.includes('super bowl') || lower.includes('basketball')) return 'Sports';
  return 'Markets';
}

function transformToTradingPrediction(event: JupiterEvent) {
  const market = event.markets?.[0];
  const pricing = market?.pricing;

  // Parse pricing (micro USD to decimal)
  const yesPriceUsd = pricing?.buyYesPriceUsd ? parseFloat(pricing.buyYesPriceUsd) / 1_000_000 : 0.5;
  const noPriceUsd = pricing?.buyNoPriceUsd ? parseFloat(pricing.buyNoPriceUsd) / 1_000_000 : 0.5;
  const yesPct = Math.round(yesPriceUsd * 100);

  return {
    id: event.eventId,
    question: event.title || market?.title || '',
    marketOdds: yesPct,
    source: market?.provider || 'jupiter',
    endDate: event.endTime || market?.closeTime || undefined,
    dflow: {
      ticker: event.eventId,
      seriesTicker: market?.marketId || '',
      volume24h: pricing?.volume24h ? parseFloat(pricing.volume24h) / 1_000_000 : 0,
      openInterest: pricing?.openInterest ? parseFloat(pricing.openInterest) / 1_000_000 : 0,
      yesBid: yesPriceUsd,
      yesAsk: yesPriceUsd,
      noBid: noPriceUsd,
      noAsk: noPriceUsd,
      spread: 0,
      tokens: market?.onChain ? {
        yesMint: market.onChain.yesMint || null,
        noMint: market.onChain.noMint || null,
        marketLedger: market.onChain.marketPubkey,
        isInitialized: true,
        redemptionStatus: 'open' as const,
      } : null,
    } as DFlowData,
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN PAGE COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const marketId = decodeURIComponent(params.id as string);
  const { isAuthenticated: authenticated, login } = useUser();

  const [market, setMarket] = useState<JupiterEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTradingModal, setShowTradingModal] = useState(false);
  const [side, setSide] = useState<'YES' | 'NO'>('YES');
  const [relatedMarkets, setRelatedMarkets] = useState<JupiterEvent[]>([]);

  // Load market data
  useEffect(() => {
    async function loadMarket() {
      setLoading(true);
      setError(null);
      try {
        const response = await getJupiterEvent(marketId);
        if (response.success && response.data) {
          setMarket(response.data);
        } else {
          setError('Market not found');
        }

        // Load related markets
        const hotResponse = await getJupiterHotEvents(8);
        if (hotResponse.success && hotResponse.data) {
          const filtered = hotResponse.data
            .filter(e => e.eventId !== marketId)
            .slice(0, 4);
          setRelatedMarkets(filtered);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load market');
      } finally {
        setLoading(false);
      }
    }
    if (marketId) {
      loadMarket();
    }
  }, [marketId]);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: market?.title || 'BeRight Market', url });
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
    }
  }, [market]);

  const category = market ? categorizeMarket(market.title || '') : '';

  // Extract market data from Jupiter event into compatible format
  const marketData = useMemo(() => {
    if (!market) return null;
    const mkt = market.markets?.[0];
    const pricing = mkt?.pricing;

    // Parse pricing (micro USD to decimal)
    const yesPriceUsd = pricing?.buyYesPriceUsd ? parseFloat(pricing.buyYesPriceUsd) / 1_000_000 : 0.5;
    const noPriceUsd = pricing?.buyNoPriceUsd ? parseFloat(pricing.buyNoPriceUsd) / 1_000_000 : 0.5;
    const sellYesPriceUsd = pricing?.sellYesPriceUsd ? parseFloat(pricing.sellYesPriceUsd) / 1_000_000 : yesPriceUsd;
    const sellNoPriceUsd = pricing?.sellNoPriceUsd ? parseFloat(pricing.sellNoPriceUsd) / 1_000_000 : noPriceUsd;

    return {
      title: market.title || mkt?.title || '',
      subtitle: mkt?.title !== market.title ? mkt?.title : null,
      imageUrl: market.imageUrl || market.metadata?.imageUrl || null,
      yesPct: Math.round(yesPriceUsd * 100),
      noPct: Math.round(noPriceUsd * 100),
      yesAsk: yesPriceUsd,
      yesBid: sellYesPriceUsd,
      noAsk: noPriceUsd,
      noBid: sellNoPriceUsd,
      spread: Math.abs(yesPriceUsd - sellYesPriceUsd),
      volume: pricing?.volume ? parseFloat(pricing.volume) / 1_000_000 : 0,
      volume24h: pricing?.volume24h ? parseFloat(pricing.volume24h) / 1_000_000 : 0,
      openInterest: pricing?.openInterest ? parseFloat(pricing.openInterest) / 1_000_000 : 0,
      liquidity: pricing?.liquidity ? parseFloat(pricing.liquidity) / 1_000_000 : 0,
      endDate: market.endTime || mkt?.closeTime || null,
      status: market.status || 'active',
      url: `https://app.jup.ag/predictions/${market.eventId}`,
      source: mkt?.provider || 'jupiter',
    };
  }, [market]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LOADING STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (loading) {
    return (
      <div className="page">
        <div className="loading-container">
          <div className="loading-spinner" />
          <p>Loading market...</p>
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ERROR STATE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  if (error || !market || !marketData) {
    return (
      <div className="page">
        <div className="error-container">
          <div className="error-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h1>Market Not Found</h1>
          <p>{error || 'This market may have been removed or the link is invalid.'}</p>
          <button onClick={() => router.push('/markets')} className="back-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Markets
          </button>
        </div>
        <style jsx>{pageStyles}</style>
      </div>
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // MAIN CONTENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const yesPrice = marketData.yesPct;
  const noPrice = marketData.noPct;

  return (
    <div className="page">
      {/* ━━━ HEADER ━━━ */}
      <header className="header">
        <button className="icon-btn" onClick={() => router.back()} aria-label="Go back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <nav className="breadcrumb">
          <Link href="/markets">Markets</Link>
          <span>/</span>
          <span className="category">{category}</span>
        </nav>
        <button className="icon-btn" onClick={handleShare} aria-label="Share">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
        </button>
      </header>

      {/* ━━━ MAIN LAYOUT ━━━ */}
      <div className="layout">
        {/* ━━━ LEFT: MARKET INFO ━━━ */}
        <main className="main">
          {/* Title Section */}
          <section className="title-section">
            {marketData.imageUrl && (
              <img
                src={marketData.imageUrl}
                alt=""
                className="market-image"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            )}
            <div className="title-content">
              <h1>{marketData.title}</h1>
              {marketData.subtitle && <p className="subtitle">{marketData.subtitle}</p>}
            </div>
          </section>

          {/* Probability Hero */}
          <section className="probability-hero">
            <div className="prob-main">
              <span className="prob-number">{marketData.yesPct}</span>
              <span className="prob-percent">%</span>
              <span className="prob-label">chance</span>
            </div>
            <div className="prob-meta">
              <div className="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span>{formatTimeRemaining(marketData.endDate)}</span>
              </div>
              <div className="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
                </svg>
                <span>{formatVolume(marketData.volume24h)} 24h</span>
              </div>
              <div className="meta-item">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
                <span>{Math.round(marketData.openInterest).toLocaleString()} traders</span>
              </div>
            </div>
          </section>

          {/* Chart Section - Simplified without candlestick API */}
          <section className="chart-section">
            <div className="chart-header">
              <div className="chart-info">
                <span className="chart-price">{marketData.yesPct}%</span>
              </div>
            </div>
            <div className="chart-canvas">
              <div className="chart-empty">Price history coming soon</div>
            </div>
          </section>

          {/* Market Rules */}
          <section className="rules-section">
            <h2>Market Rules</h2>
            <div className="rules-content">
              <div className="rule-block">
                <h3>Resolution</h3>
                <p>
                  This market resolves to &ldquo;Yes&rdquo; if the event occurs before{' '}
                  <strong>{marketData.endDate ? formatDate(marketData.endDate) : 'the expiration date'}</strong>.
                  Otherwise, it resolves to &ldquo;No&rdquo;.
                </p>
              </div>
              <div className="rule-block stats-grid">
                <div className="stat-box">
                  <span className="stat-label">Total Volume</span>
                  <span className="stat-value">{formatVolume(marketData.volume)}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Liquidity</span>
                  <span className="stat-value">{formatVolume(marketData.liquidity)}</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Platform</span>
                  <span className="stat-value">Jupiter</span>
                </div>
                <div className="stat-box">
                  <span className="stat-label">Status</span>
                  <span className={`stat-value status-${marketData.status}`}>{marketData.status}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Related Markets */}
          {relatedMarkets.length > 0 && (
            <section className="related-section">
              <h2>More Markets</h2>
              <div className="related-grid">
                {relatedMarkets.map((m) => {
                  const mkt = m.markets?.[0];
                  const yesPct = mkt?.pricing?.buyYesPriceUsd
                    ? Math.round(parseFloat(mkt.pricing.buyYesPriceUsd) / 1_000_000 * 100)
                    : 50;
                  const vol = mkt?.pricing?.volume
                    ? parseFloat(mkt.pricing.volume) / 1_000_000
                    : 0;
                  return (
                    <Link key={m.eventId} href={`/market/${encodeURIComponent(m.eventId)}`} className="related-card">
                      <p className="related-title">{m.title}</p>
                      <div className="related-footer">
                        <span className="related-prob">{yesPct}%</span>
                        <span className="related-vol">{formatVolume(vol)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </main>

        {/* ━━━ RIGHT: TRADING PANEL ━━━ */}
        <aside className="sidebar">
          <div className="trading-card">
            <div className="trading-header">
              <h2>Trade</h2>
              <a href={marketData.url} target="_blank" rel="noopener noreferrer" className="external-link">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            </div>

            {/* Side Selector */}
            <div className="side-buttons">
              <button
                className={`side-btn yes ${side === 'YES' ? 'active' : ''}`}
                onClick={() => setSide('YES')}
              >
                <span className="side-label">Yes</span>
                <span className="side-price">{yesPrice}c</span>
              </button>
              <button
                className={`side-btn no ${side === 'NO' ? 'active' : ''}`}
                onClick={() => setSide('NO')}
              >
                <span className="side-label">No</span>
                <span className="side-price">{noPrice}c</span>
              </button>
            </div>

            {/* Order Book Preview */}
            <div className="orderbook">
              <div className="ob-row">
                <span className="ob-label">Bid</span>
                <span className="ob-value">{side === 'YES' ? (marketData.yesBid * 100).toFixed(1) : (marketData.noBid * 100).toFixed(1)}c</span>
              </div>
              <div className="ob-row">
                <span className="ob-label">Ask</span>
                <span className="ob-value">{side === 'YES' ? (marketData.yesAsk * 100).toFixed(1) : (marketData.noAsk * 100).toFixed(1)}c</span>
              </div>
              <div className="ob-row">
                <span className="ob-label">Spread</span>
                <span className="ob-value highlight">{(marketData.spread * 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Trade Button */}
            {authenticated ? (
              <button className="trade-cta" onClick={() => setShowTradingModal(true)}>
                Buy {side}
              </button>
            ) : (
              <button className="trade-cta connect" onClick={login}>
                Connect Wallet
              </button>
            )}

            {/* Quick Stats */}
            <div className="quick-stats">
              <div className="qs-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
                </svg>
                <span>{formatVolume(marketData.volume)}</span>
              </div>
              <div className="qs-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                </svg>
                <span>{Math.round(marketData.openInterest).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Trading Modal */}
      {showTradingModal && (
        <TradingModal
          isOpen={showTradingModal}
          onClose={() => setShowTradingModal(false)}
          prediction={transformToTradingPrediction(market)}
        />
      )}

      <style jsx>{pageStyles}</style>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STYLES - BeRight Design System
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const pageStyles = `
  /* ━━━ RESET & BASE ━━━ */
  .page {
    min-height: 100dvh;
    background: #0F172A;
    color: #F8FAFC;
    font-family: 'Exo 2', -apple-system, sans-serif;
    padding-bottom: calc(var(--app-bottom-offset) + 16px);
  }

  /* ━━━ LOADING ━━━ */
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    gap: 16px;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #1E293B;
    border-top-color: #F59E0B;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .loading-container p {
    color: #94A3B8;
    font-size: 14px;
  }

  /* ━━━ ERROR ━━━ */
  .error-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 80vh;
    gap: 20px;
    padding: 24px;
    text-align: center;
  }

  .error-icon {
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .error-container h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 28px;
    margin: 0;
    color: #F8FAFC;
  }

  .error-container p {
    color: #94A3B8;
    font-size: 15px;
    max-width: 400px;
    margin: 0;
  }

  .back-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 28px;
    background: linear-gradient(135deg, #8B5CF6 0%, #F59E0B 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.3);
  }

  /* ━━━ HEADER ━━━ */
  .header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(248, 250, 252, 0.08);
    position: sticky;
    top: 0;
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(12px);
    z-index: 100;
  }

  .icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    background: transparent;
    border: 1px solid rgba(248, 250, 252, 0.1);
    border-radius: 12px;
    color: #94A3B8;
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-btn:hover {
    border-color: #F59E0B;
    color: #F59E0B;
    background: rgba(245, 158, 11, 0.1);
  }

  .breadcrumb {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 16px;
    font-size: 14px;
  }

  .breadcrumb a {
    color: #64748B;
    text-decoration: none;
    transition: color 0.2s;
  }

  .breadcrumb a:hover {
    color: #F59E0B;
  }

  .breadcrumb span {
    color: #475569;
  }

  .breadcrumb .category {
    color: #F59E0B;
    font-weight: 500;
  }

  /* ━━━ LAYOUT ━━━ */
  .layout {
    display: grid;
    grid-template-columns: 1fr 380px;
    gap: 32px;
    max-width: 1400px;
    margin: 0 auto;
    padding: 28px 24px;
  }

  @media (max-width: 1024px) {
    .layout {
      grid-template-columns: 1fr;
      padding: 20px 16px;
    }
    .sidebar { order: -1; }
  }

  .main {
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* ━━━ TITLE SECTION ━━━ */
  .title-section {
    display: flex;
    gap: 20px;
    align-items: flex-start;
  }

  .market-image {
    width: 72px;
    height: 72px;
    border-radius: 16px;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgba(248, 250, 252, 0.1);
  }

  .title-content h1 {
    font-family: 'Orbitron', sans-serif;
    font-size: 26px;
    font-weight: 600;
    line-height: 1.35;
    margin: 0;
    color: #F8FAFC;
  }

  .subtitle {
    margin: 10px 0 0;
    color: #94A3B8;
    font-size: 15px;
  }

  @media (max-width: 640px) {
    .title-section { flex-direction: column; gap: 16px; }
    .market-image { width: 56px; height: 56px; }
    .title-content h1 { font-size: 22px; }
  }

  /* ━━━ PROBABILITY HERO ━━━ */
  .probability-hero {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 28px 32px;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%);
    border: 1px solid rgba(245, 158, 11, 0.2);
    border-radius: 20px;
  }

  .prob-main {
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .prob-number {
    font-family: 'Orbitron', sans-serif;
    font-size: 64px;
    font-weight: 700;
    color: #F59E0B;
    line-height: 1;
    text-shadow: 0 0 40px rgba(245, 158, 11, 0.5);
  }

  .prob-percent {
    font-family: 'Orbitron', sans-serif;
    font-size: 32px;
    font-weight: 600;
    color: #F59E0B;
  }

  .prob-label {
    font-size: 18px;
    color: #94A3B8;
    margin-left: 8px;
  }

  .prob-meta {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-end;
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #94A3B8;
  }

  .meta-item svg {
    color: #64748B;
  }

  @media (max-width: 640px) {
    .probability-hero {
      flex-direction: column;
      align-items: flex-start;
      gap: 20px;
      padding: 24px;
    }
    .prob-meta {
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 16px;
    }
    .prob-number { font-size: 48px; }
    .prob-percent { font-size: 24px; }
  }

  /* ━━━ CHART ━━━ */
  .chart-section {
    background: #0B1120;
    border: 1px solid rgba(248, 250, 252, 0.08);
    border-radius: 20px;
    padding: 24px;
  }

  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .chart-info {
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .chart-price {
    font-family: 'Orbitron', sans-serif;
    font-size: 24px;
    font-weight: 600;
    color: #F8FAFC;
  }

  .chart-change {
    font-size: 14px;
    font-weight: 600;
  }

  .chart-change.up { color: #F59E0B; }
  .chart-change.down { color: #F43F5E; }

  .time-selector {
    display: flex;
    gap: 4px;
  }

  .time-btn {
    padding: 8px 14px;
    font-size: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-weight: 500;
    background: transparent;
    border: 1px solid rgba(248, 250, 252, 0.1);
    color: #64748B;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .time-btn:hover {
    border-color: #94A3B8;
    color: #F8FAFC;
  }

  .time-btn.active {
    background: #F59E0B;
    border-color: #F59E0B;
    color: #0F172A;
  }

  .chart-canvas {
    height: 220px;
    position: relative;
  }

  .chart-svg {
    width: 100%;
    height: 100%;
  }

  .chart-loading,
  .chart-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #64748B;
    font-size: 14px;
  }

  /* ━━━ RULES ━━━ */
  .rules-section {
    background: #0B1120;
    border: 1px solid rgba(248, 250, 252, 0.08);
    border-radius: 20px;
    padding: 24px;
  }

  .rules-section h2 {
    font-family: 'Orbitron', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: #F8FAFC;
    margin: 0 0 20px;
  }

  .rules-content {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .rule-block h3 {
    font-size: 13px;
    font-weight: 600;
    color: #F59E0B;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin: 0 0 10px;
  }

  .rule-block p {
    font-size: 14px;
    line-height: 1.7;
    color: #94A3B8;
    margin: 0;
  }

  .rule-block strong {
    color: #F8FAFC;
  }

  .sources {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .source-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    background: rgba(139, 92, 246, 0.1);
    border: 1px solid rgba(139, 92, 246, 0.2);
    border-radius: 8px;
    color: #A78BFA;
    font-size: 13px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .source-link:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: #8B5CF6;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  @media (max-width: 640px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
  }

  .stat-box {
    background: rgba(248, 250, 252, 0.03);
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stat-label {
    font-size: 11px;
    color: #64748B;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-value {
    font-size: 15px;
    font-weight: 600;
    color: #F8FAFC;
  }

  .stat-value.status-active { color: #10B981; }
  .stat-value.status-finalized { color: #64748B; }

  /* ━━━ RELATED ━━━ */
  .related-section h2 {
    font-family: 'Orbitron', sans-serif;
    font-size: 18px;
    font-weight: 600;
    color: #F8FAFC;
    margin: 0 0 16px;
  }

  .related-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
  }

  @media (max-width: 640px) {
    .related-grid { grid-template-columns: 1fr; }
  }

  .related-card {
    background: #0B1120;
    border: 1px solid rgba(248, 250, 252, 0.08);
    border-radius: 14px;
    padding: 18px;
    text-decoration: none;
    transition: all 0.2s;
    cursor: pointer;
  }

  .related-card:hover {
    border-color: #F59E0B;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .related-title {
    font-size: 14px;
    font-weight: 500;
    color: #F8FAFC;
    line-height: 1.5;
    margin: 0 0 14px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .related-footer {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .related-prob {
    color: #F59E0B;
    font-weight: 600;
    font-family: 'JetBrains Mono', monospace;
  }

  .related-vol {
    color: #64748B;
  }

  /* ━━━ TRADING CARD ━━━ */
  .sidebar {
    position: sticky;
    top: 100px;
    align-self: start;
  }

  .trading-card {
    background: #0B1120;
    border: 1px solid rgba(248, 250, 252, 0.08);
    border-radius: 20px;
    padding: 24px;
  }

  .trading-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .trading-header h2 {
    font-family: 'Orbitron', sans-serif;
    font-size: 20px;
    font-weight: 600;
    color: #F8FAFC;
    margin: 0;
  }

  .external-link {
    color: #64748B;
    transition: color 0.2s;
  }

  .external-link:hover {
    color: #F59E0B;
  }

  /* Side Buttons */
  .side-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 20px;
  }

  .side-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 18px 16px;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
    border: 2px solid transparent;
  }

  .side-btn.yes {
    background: rgba(16, 185, 129, 0.1);
    border-color: rgba(16, 185, 129, 0.3);
  }

  .side-btn.yes .side-label { color: #10B981; }
  .side-btn.yes .side-price { color: #34D399; }

  .side-btn.yes:hover,
  .side-btn.yes.active {
    background: #10B981;
    border-color: #10B981;
  }

  .side-btn.yes:hover .side-label,
  .side-btn.yes.active .side-label,
  .side-btn.yes:hover .side-price,
  .side-btn.yes.active .side-price {
    color: #0F172A;
  }

  .side-btn.no {
    background: rgba(244, 63, 94, 0.1);
    border-color: rgba(244, 63, 94, 0.3);
  }

  .side-btn.no .side-label { color: #F43F5E; }
  .side-btn.no .side-price { color: #FB7185; }

  .side-btn.no:hover,
  .side-btn.no.active {
    background: #F43F5E;
    border-color: #F43F5E;
  }

  .side-btn.no:hover .side-label,
  .side-btn.no.active .side-label,
  .side-btn.no:hover .side-price,
  .side-btn.no.active .side-price {
    color: white;
  }

  .side-label {
    font-size: 14px;
    font-weight: 600;
  }

  .side-price {
    font-size: 20px;
    font-weight: 700;
    font-family: 'JetBrains Mono', monospace;
  }

  /* Orderbook */
  .orderbook {
    background: rgba(248, 250, 252, 0.03);
    border-radius: 14px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .ob-row {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    font-size: 14px;
  }

  .ob-row:not(:last-child) {
    border-bottom: 1px solid rgba(248, 250, 252, 0.05);
  }

  .ob-label { color: #64748B; }
  .ob-value {
    color: #F8FAFC;
    font-family: 'JetBrains Mono', monospace;
  }
  .ob-value.highlight { color: #F59E0B; }

  /* Trade CTA */
  .trade-cta {
    width: 100%;
    padding: 18px;
    font-size: 17px;
    font-weight: 700;
    background: linear-gradient(135deg, #8B5CF6 0%, #F59E0B 100%);
    color: white;
    border: none;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .trade-cta:hover {
    opacity: 0.92;
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(139, 92, 246, 0.35);
  }

  .trade-cta.connect {
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
  }

  /* Quick Stats */
  .quick-stats {
    display: flex;
    justify-content: center;
    gap: 32px;
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid rgba(248, 250, 252, 0.08);
  }

  .qs-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94A3B8;
  }

  .qs-item svg { color: #64748B; }
`;
