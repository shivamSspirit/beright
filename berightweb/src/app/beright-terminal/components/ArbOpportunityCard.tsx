'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArbOpportunity } from '@/lib/api';
import LivePriceChart from './LivePriceChart';

interface ArbOpportunityCardProps {
  opportunity: ArbOpportunity;
  onTrade?: (leg: 'leg1' | 'leg2', url: string) => void;
}

/**
 * ArbOpportunityCard - CrossOdds-style arbitrage opportunity display
 *
 * Shows detailed arbitrage information including:
 * - Quality score and confidence grade
 * - Trade instructions with platform-specific prices
 * - Profit calculator
 * - Risk assessment
 * - Direct platform links
 */
export default function ArbOpportunityCard({ opportunity, onTrade }: ArbOpportunityCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [positionSize, setPositionSize] = useState(opportunity.sizing.recommended);

  const { trade, market, risk, sizing } = opportunity;

  // Quality badge styling
  const qualityStyles = {
    excellent: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.5)', text: '#22C55E' },
    good: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', text: '#3B82F6' },
    fair: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.5)', text: '#F59E0B' },
    poor: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.5)', text: '#EF4444' },
  };

  const riskStyles = {
    low: { color: '#22C55E', icon: '🟢' },
    medium: { color: '#F59E0B', icon: '🟡' },
    high: { color: '#EF4444', icon: '🔴' },
  };

  const gradeColors = {
    A: '#22C55E',
    B: '#3B82F6',
    C: '#F59E0B',
    D: '#F97316',
    F: '#EF4444',
  };

  // Calculate profit for current position size
  const calculatedProfit = (positionSize * trade.profitPercent / 100).toFixed(2);

  return (
    <motion.div
      className="arb-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: `1px solid ${qualityStyles[opportunity.quality].border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        marginBottom: '16px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          {/* Quality Badge */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                background: qualityStyles[opportunity.quality].bg,
                color: qualityStyles[opportunity.quality].text,
                border: `1px solid ${qualityStyles[opportunity.quality].border}`,
              }}
            >
              {opportunity.quality} ({opportunity.qualityScore}%)
            </span>
            <span
              style={{
                fontSize: '12px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 500,
              }}
            >
              {market.category}
            </span>
            {opportunity._demo && (
              <span style={{ fontSize: '10px', color: '#F59E0B', fontWeight: 600 }}>DEMO</span>
            )}
          </div>

          {/* Profit Highlight */}
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: '#22C55E',
                lineHeight: 1,
              }}
            >
              +{trade.profitDisplay}
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
              {trade.profitPercent.toFixed(2)}% profit
            </div>
          </div>
        </div>

        {/* Market Question */}
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: '#fff',
            margin: '0 0 16px 0',
            lineHeight: 1.4,
          }}
        >
          {market.question}
        </h3>

        {/* Trade Summary */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Leg 1 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              flex: 1,
              minWidth: '140px',
            }}
          >
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                background: trade.leg1.platform === 'kalshi' ? '#00C2FF' : '#8B5CF6',
                color: '#000',
              }}
            >
              {trade.leg1.platformDisplayName.toUpperCase()}
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>→</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Buy</span>
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                background: trade.leg1.side === 'YES' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: trade.leg1.side === 'YES' ? '#22C55E' : '#EF4444',
              }}
            >
              {trade.leg1.side}
            </span>
            <span style={{ color: '#fff', fontWeight: 600, marginLeft: 'auto' }}>
              {trade.leg1.priceDisplay}
            </span>
          </div>

          <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontWeight: 600 }}>+</span>

          {/* Leg 2 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '8px',
              flex: 1,
              minWidth: '140px',
            }}
          >
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                background: trade.leg2.platform === 'kalshi' ? '#00C2FF' : '#8B5CF6',
                color: '#000',
              }}
            >
              {trade.leg2.platformDisplayName.toUpperCase()}
            </span>
            <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>→</span>
            <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>Buy</span>
            <span
              style={{
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                background: trade.leg2.side === 'YES' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: trade.leg2.side === 'YES' ? '#22C55E' : '#EF4444',
              }}
            >
              {trade.leg2.side}
            </span>
            <span style={{ color: '#fff', fontWeight: 600, marginLeft: 'auto' }}>
              {trade.leg2.priceDisplay}
            </span>
          </div>
        </div>

        {/* Cost Summary */}
        <div
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: 'rgba(34, 197, 94, 0.1)',
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>
            Total cost: <strong style={{ color: '#fff' }}>{trade.totalCostDisplay}</strong>
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>→</span>
          <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '13px' }}>
            Payout: <strong style={{ color: '#fff' }}>$1.00</strong>
          </span>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>→</span>
          <span style={{ color: '#22C55E', fontSize: '13px', fontWeight: 600 }}>
            Profit: {trade.profitDisplay}
          </span>
        </div>

        {/* Expand indicator */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '12px' }}>
            {expanded ? '▲ Less details' : '▼ More details'}
          </span>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              {/* Live Price Chart */}
              <div style={{ marginBottom: '20px' }}>
                <LivePriceChart
                  platform1={{
                    name: trade.leg1.platform,
                    displayName: trade.leg1.platformDisplayName,
                    side: trade.leg1.side,
                    currentPrice: trade.leg1.price,
                    color: '#00C2FF',
                  }}
                  platform2={{
                    name: trade.leg2.platform,
                    displayName: trade.leg2.platformDisplayName,
                    side: trade.leg2.side,
                    currentPrice: trade.leg2.price,
                    color: '#22C55E',
                  }}
                  height={160}
                  updateInterval={5000}
                  historyLength={20}
                />
              </div>

              {/* Profit Calculator */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '12px' }}>
                  💵 PROFIT CALCULATOR
                </h4>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', display: 'block', marginBottom: '4px' }}>
                      Position Size (USD)
                    </label>
                    <input
                      type="number"
                      value={positionSize}
                      onChange={(e) => setPositionSize(Number(e.target.value))}
                      min={sizing.minimum}
                      max={sizing.maximum}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '14px',
                      }}
                    />
                  </div>
                  <div style={{ textAlign: 'center', padding: '0 16px' }}>
                    <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '4px' }}>Profit</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: '#22C55E' }}>${calculatedProfit}</div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                    Recommended: ${sizing.recommended} | Max: ${sizing.maximum}
                  </div>
                </div>
              </div>

              {/* Risk Assessment */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '12px' }}>
                  ⚠️ RISK ASSESSMENT
                </h4>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: riskStyles[risk.level].color, fontWeight: 600 }}>
                    {riskStyles[risk.level].icon} {risk.level.toUpperCase()} RISK
                  </span>
                  <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}>
                    Score: {risk.score}/100
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: `${gradeColors[opportunity.confidenceGrade]}20`,
                      color: gradeColors[opportunity.confidenceGrade],
                    }}
                  >
                    Grade {opportunity.confidenceGrade}
                  </span>
                </div>
                {risk.executionWarnings.length > 0 && (
                  <ul style={{ margin: 0, padding: '0 0 0 20px', color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                    {risk.executionWarnings.map((warning, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>{warning}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Resolution Rules */}
              {market.resolutionRules && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.7)', marginBottom: '8px' }}>
                    📋 RESOLUTION RULES
                  </h4>
                  <p style={{ margin: 0, fontSize: '12px', color: 'rgba(255, 255, 255, 0.6)', lineHeight: 1.5 }}>
                    {market.resolutionRules}
                  </p>
                  {market.resolutionDate && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'rgba(255, 255, 255, 0.5)' }}>
                      Resolves: {new Date(market.resolutionDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              )}

              {/* Trade Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <a
                  href={trade.leg1.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: trade.leg1.platform === 'kalshi' ? '#00C2FF' : '#8B5CF6',
                    color: '#000',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onClick={() => onTrade?.('leg1', trade.leg1.url)}
                >
                  Trade on {trade.leg1.platformDisplayName}
                  <span style={{ fontSize: '10px' }}>↗</span>
                </a>
                <a
                  href={trade.leg2.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: trade.leg2.platform === 'kalshi' ? '#00C2FF' : '#8B5CF6',
                    color: '#000',
                    borderRadius: '8px',
                    fontWeight: 600,
                    fontSize: '13px',
                    textDecoration: 'none',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  onClick={() => onTrade?.('leg2', trade.leg2.url)}
                >
                  Trade on {trade.leg2.platformDisplayName}
                  <span style={{ fontSize: '10px' }}>↗</span>
                </a>
              </div>

              {/* Footer Meta */}
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.4)',
                }}
              >
                <span>Detected: {new Date(opportunity.detectedAt).toLocaleString()}</span>
                <span>Price age: {opportunity.priceAge}s</span>
                <span>{market.relatedMarkets} markets in event</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
