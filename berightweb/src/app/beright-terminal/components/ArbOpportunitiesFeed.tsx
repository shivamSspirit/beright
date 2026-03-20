'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { getCrossOddsArbitrage, ArbOpportunity } from '@/lib/api';
import ArbOpportunityCard from './ArbOpportunityCard';

interface ArbOpportunitiesFeedProps {
  minProfit?: number;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

/**
 * ArbOpportunitiesFeed - CrossOdds-style arbitrage feed
 *
 * Displays a live feed of cross-platform arbitrage opportunities
 * with automatic refresh and filtering.
 */
export default function ArbOpportunitiesFeed({
  minProfit = 2,
  limit = 10,
  autoRefresh = true,
  refreshInterval = 30000,
}: ArbOpportunitiesFeedProps) {
  const [opportunities, setOpportunities] = useState<ArbOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [meta, setMeta] = useState<{
    totalScanned: number;
    pairsEvaluated: number;
    scanDurationMs: number;
    platforms: string[];
    source: 'demo' | 'live';
  } | null>(null);

  const fetchOpportunities = useCallback(async () => {
    try {
      setError(null);
      const response = await getCrossOddsArbitrage({ minProfit, limit });

      if (response.success) {
        setOpportunities(response.data.opportunities);
        setMeta({
          ...response.data.meta,
          source: response.meta.source,
        });
        setLastUpdated(new Date());
      } else {
        setError('Failed to fetch opportunities');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [minProfit, limit]);

  // Initial fetch
  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchOpportunities, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchOpportunities]);

  // Loading state
  if (loading && opportunities.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: 'rgba(255, 255, 255, 0.5)',
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'inline-block', marginBottom: '12px' }}
        >
          ⚡
        </motion.div>
        <div>Scanning for arbitrage opportunities...</div>
        <div style={{ fontSize: '12px', marginTop: '8px' }}>
          Analyzing markets across platforms
        </div>
      </div>
    );
  }

  // Error state
  if (error && opportunities.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          color: '#EF4444',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
        <div>{error}</div>
        <button
          onClick={fetchOpportunities}
          style={{
            marginTop: '16px',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.1)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '6px',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ⚡ Cross-Platform Arbitrage
            {meta?.source === 'demo' && (
              <span style={{ fontSize: '10px', padding: '2px 6px', background: '#F59E0B', color: '#000', borderRadius: '4px' }}>
                DEMO
              </span>
            )}
          </h2>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)', marginTop: '4px' }}>
            {meta && (
              <>
                Scanned {meta.totalScanned} markets across {meta.platforms.join(', ')} in {meta.scanDurationMs}ms
              </>
            )}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
            Min profit: {minProfit}%
          </div>
          {lastUpdated && (
            <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', marginTop: '2px' }}>
              Updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Opportunities */}
      {opportunities.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚖️</div>
          <h3 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '18px' }}>
            No Arbitrage Opportunities Detected
          </h3>
          <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px' }}>
            Markets are efficiently priced at the moment.
          </p>
          <p style={{ margin: '8px 0 0 0', color: 'rgba(255, 255, 255, 0.4)', fontSize: '12px' }}>
            Auto-refreshing every {refreshInterval / 1000}s
          </p>
        </div>
      ) : (
        <div>
          {/* Summary bar */}
          <div
            style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '16px',
              padding: '12px 16px',
              background: 'rgba(34, 197, 94, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}
          >
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Opportunities: </span>
              <strong style={{ color: '#22C55E' }}>{opportunities.length}</strong>
            </div>
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Best profit: </span>
              <strong style={{ color: '#22C55E' }}>
                {Math.max(...opportunities.map(o => o.trade.profitPercent)).toFixed(2)}%
              </strong>
            </div>
            <div>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>Avg profit: </span>
              <strong style={{ color: '#22C55E' }}>
                {(opportunities.reduce((sum, o) => sum + o.trade.profitPercent, 0) / opportunities.length).toFixed(2)}%
              </strong>
            </div>
          </div>

          {/* Cards */}
          {opportunities.map((opp) => (
            <ArbOpportunityCard
              key={opp.id}
              opportunity={opp}
              onTrade={(leg, url) => {
                console.log(`[ArbFeed] Trade clicked: ${leg}, ${url}`);
              }}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px 16px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)' }}>
            ⚠️ Verify prices on platforms before executing. Prices shown at scan time.
          </div>
          <button
            onClick={fetchOpportunities}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: loading ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '6px',
              color: '#fff',
              fontSize: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Scanning...' : '🔄 Refresh'}
          </button>
        </div>
      </div>
    </div>
  );
}
