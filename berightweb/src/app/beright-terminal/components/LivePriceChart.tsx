'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';

interface PricePoint {
  timestamp: number;
  platform1Price: number;
  platform2Price: number;
}

interface LivePriceChartProps {
  platform1: {
    name: string;
    displayName: string;
    side: 'YES' | 'NO';
    currentPrice: number;
    color?: string;
  };
  platform2: {
    name: string;
    displayName: string;
    side: 'YES' | 'NO';
    currentPrice: number;
    color?: string;
  };
  height?: number;
  showLegend?: boolean;
  updateInterval?: number; // ms
  historyLength?: number; // number of points to keep
}

/**
 * LivePriceChart - Real-time dual-line price chart
 *
 * Shows two platform prices tracking over time with:
 * - Smooth SVG line rendering
 * - Real-time updates with animation
 * - Price tooltips on hover
 * - Y-axis with price scale
 * - Time axis with auto-updating labels
 *
 * Design: Dark theme, cyan/green colors, minimal style
 */
export default function LivePriceChart({
  platform1,
  platform2,
  height = 180,
  showLegend = true,
  updateInterval = 5000,
  historyLength = 30,
}: LivePriceChartProps) {
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  // Colors
  const colors = {
    platform1: platform1.color || '#00C2FF', // Cyan for Kalshi
    platform2: platform2.color || '#22C55E', // Green for Polymarket
    grid: 'rgba(255, 255, 255, 0.06)',
    axis: 'rgba(255, 255, 255, 0.2)',
    text: 'rgba(255, 255, 255, 0.5)',
    background: '#0A0F1A',
  };

  // Chart dimensions
  const padding = { top: 20, right: 60, bottom: 30, left: 10 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Initialize with some historical data
  useEffect(() => {
    const now = Date.now();
    const initialData: PricePoint[] = [];

    // Generate initial history with slight variations
    for (let i = historyLength - 1; i >= 0; i--) {
      const time = now - i * updateInterval;
      const variance1 = (Math.random() - 0.5) * 0.02;
      const variance2 = (Math.random() - 0.5) * 0.02;

      initialData.push({
        timestamp: time,
        platform1Price: Math.max(0.01, Math.min(0.99, platform1.currentPrice + variance1)),
        platform2Price: Math.max(0.01, Math.min(0.99, platform2.currentPrice + variance2)),
      });
    }

    // Set final point to current prices
    if (initialData.length > 0) {
      initialData[initialData.length - 1].platform1Price = platform1.currentPrice;
      initialData[initialData.length - 1].platform2Price = platform2.currentPrice;
    }

    setPriceHistory(initialData);
  }, [platform1.currentPrice, platform2.currentPrice, historyLength, updateInterval]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPriceHistory((prev) => {
        const now = Date.now();
        const variance1 = (Math.random() - 0.5) * 0.01;
        const variance2 = (Math.random() - 0.5) * 0.01;

        const newPoint: PricePoint = {
          timestamp: now,
          platform1Price: Math.max(0.01, Math.min(0.99, platform1.currentPrice + variance1)),
          platform2Price: Math.max(0.01, Math.min(0.99, platform2.currentPrice + variance2)),
        };

        const updated = [...prev, newPoint];
        // Keep only the last N points
        return updated.slice(-historyLength);
      });
    }, updateInterval);

    return () => clearInterval(interval);
  }, [platform1.currentPrice, platform2.currentPrice, updateInterval, historyLength]);

  // Responsive width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Calculate scales
  const scales = useMemo(() => {
    if (priceHistory.length === 0) {
      return { minPrice: 0, maxPrice: 1, xScale: () => 0, yScale: () => 0 };
    }

    const allPrices = priceHistory.flatMap((p) => [p.platform1Price, p.platform2Price]);
    const minPrice = Math.max(0, Math.min(...allPrices) - 0.05);
    const maxPrice = Math.min(1, Math.max(...allPrices) + 0.05);
    const priceRange = maxPrice - minPrice || 0.1;

    const timeMin = priceHistory[0].timestamp;
    const timeMax = priceHistory[priceHistory.length - 1].timestamp;
    const timeRange = timeMax - timeMin || 1;

    const xScale = (timestamp: number) =>
      padding.left + ((timestamp - timeMin) / timeRange) * chartWidth;

    const yScale = (price: number) =>
      padding.top + (1 - (price - minPrice) / priceRange) * chartHeight;

    return { minPrice, maxPrice, xScale, yScale };
  }, [priceHistory, chartWidth, chartHeight, padding]);

  // Generate SVG paths
  const generatePath = (priceKey: 'platform1Price' | 'platform2Price') => {
    if (priceHistory.length < 2) return '';

    const points = priceHistory.map((p, i) => {
      const x = scales.xScale(p.timestamp);
      const y = scales.yScale(p[priceKey]);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });

    return points.join(' ');
  };

  // Generate area path (for gradient fill)
  const generateAreaPath = (priceKey: 'platform1Price' | 'platform2Price') => {
    if (priceHistory.length < 2) return '';

    const linePath = generatePath(priceKey);
    const lastX = scales.xScale(priceHistory[priceHistory.length - 1].timestamp);
    const firstX = scales.xScale(priceHistory[0].timestamp);
    const bottomY = padding.top + chartHeight;

    return `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  };

  // Format time for axis
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // Format price for display
  const formatPrice = (price: number) => `${(price * 100).toFixed(1)}¢`;

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const { minPrice, maxPrice } = scales;
    const range = maxPrice - minPrice;
    const tickCount = 4;
    const ticks = [];

    for (let i = 0; i <= tickCount; i++) {
      const price = minPrice + (range * i) / tickCount;
      ticks.push({
        price,
        y: scales.yScale(price),
      });
    }

    return ticks;
  }, [scales]);

  // Current prices for display
  const latestPoint = priceHistory[priceHistory.length - 1];

  return (
    <div
      ref={containerRef}
      style={{
        background: colors.background,
        borderRadius: '8px',
        padding: '12px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#22C55E',
              animation: 'pulse 2s infinite',
            }}
          />
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', fontWeight: 500 }}>
            LIVE ODDS
          </span>
        </div>
        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)' }}>
          Updates every ~{updateInterval / 1000}s
        </span>
      </div>

      {/* Chart */}
      <svg
        width={width}
        height={height}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setHoveredPoint(null)}
      >
        <defs>
          {/* Gradients for area fills */}
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.platform1} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colors.platform1} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={colors.platform2} stopOpacity="0.3" />
            <stop offset="100%" stopColor={colors.platform2} stopOpacity="0" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke={colors.grid}
            strokeDasharray="4,4"
          />
        ))}

        {/* Area fills */}
        <path d={generateAreaPath('platform1Price')} fill="url(#gradient1)" />
        <path d={generateAreaPath('platform2Price')} fill="url(#gradient2)" />

        {/* Lines */}
        <motion.path
          d={generatePath('platform1Price')}
          fill="none"
          stroke={colors.platform1}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.path
          d={generatePath('platform2Price')}
          fill="none"
          stroke={colors.platform2}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5 }}
        />

        {/* Current price dots */}
        {latestPoint && (
          <>
            <motion.circle
              cx={scales.xScale(latestPoint.timestamp)}
              cy={scales.yScale(latestPoint.platform1Price)}
              r={4}
              fill={colors.platform1}
              filter="url(#glow)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            />
            <motion.circle
              cx={scales.xScale(latestPoint.timestamp)}
              cy={scales.yScale(latestPoint.platform2Price)}
              r={4}
              fill={colors.platform2}
              filter="url(#glow)"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
            />
          </>
        )}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text
            key={i}
            x={width - padding.right + 8}
            y={tick.y + 4}
            fill={colors.text}
            fontSize="10"
            fontFamily="monospace"
          >
            {formatPrice(tick.price)}
          </text>
        ))}

        {/* Time axis */}
        {priceHistory.length > 0 && (
          <>
            <text
              x={padding.left}
              y={height - 8}
              fill={colors.text}
              fontSize="9"
              fontFamily="monospace"
            >
              {formatTime(priceHistory[0].timestamp)}
            </text>
            <text
              x={width - padding.right}
              y={height - 8}
              fill={colors.text}
              fontSize="9"
              fontFamily="monospace"
              textAnchor="end"
            >
              {formatTime(priceHistory[priceHistory.length - 1].timestamp)}
            </text>
          </>
        )}

        {/* Hover interaction points */}
        {priceHistory.map((point, i) => (
          <rect
            key={i}
            x={scales.xScale(point.timestamp) - chartWidth / priceHistory.length / 2}
            y={padding.top}
            width={chartWidth / priceHistory.length}
            height={chartHeight}
            fill="transparent"
            style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHoveredPoint(i)}
          />
        ))}

        {/* Hover tooltip */}
        {hoveredPoint !== null && priceHistory[hoveredPoint] && (
          <g>
            {/* Vertical line */}
            <line
              x1={scales.xScale(priceHistory[hoveredPoint].timestamp)}
              y1={padding.top}
              x2={scales.xScale(priceHistory[hoveredPoint].timestamp)}
              y2={padding.top + chartHeight}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeDasharray="4,4"
            />
            {/* Tooltip background */}
            <rect
              x={scales.xScale(priceHistory[hoveredPoint].timestamp) - 50}
              y={padding.top - 5}
              width={100}
              height={45}
              rx={4}
              fill="rgba(0, 0, 0, 0.85)"
              stroke="rgba(255, 255, 255, 0.2)"
            />
            {/* Tooltip text */}
            <text
              x={scales.xScale(priceHistory[hoveredPoint].timestamp)}
              y={padding.top + 10}
              fill={colors.platform1}
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
            >
              {platform1.displayName}: {formatPrice(priceHistory[hoveredPoint].platform1Price)}
            </text>
            <text
              x={scales.xScale(priceHistory[hoveredPoint].timestamp)}
              y={padding.top + 25}
              fill={colors.platform2}
              fontSize="11"
              fontWeight="600"
              textAnchor="middle"
            >
              {platform2.displayName}: {formatPrice(priceHistory[hoveredPoint].platform2Price)}
            </text>
            <text
              x={scales.xScale(priceHistory[hoveredPoint].timestamp)}
              y={padding.top + 38}
              fill="rgba(255, 255, 255, 0.5)"
              fontSize="9"
              textAnchor="middle"
            >
              {formatTime(priceHistory[hoveredPoint].timestamp)}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      {showLegend && latestPoint && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '24px',
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '3px',
                background: colors.platform1,
                borderRadius: '2px',
                boxShadow: `0 0 6px ${colors.platform1}`,
              }}
            />
            <span style={{ fontSize: '12px', color: colors.platform1, fontWeight: 500 }}>
              {platform1.displayName} {platform1.side} : {formatPrice(latestPoint.platform1Price)}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '3px',
                background: colors.platform2,
                borderRadius: '2px',
                boxShadow: `0 0 6px ${colors.platform2}`,
              }}
            />
            <span style={{ fontSize: '12px', color: colors.platform2, fontWeight: 500 }}>
              {platform2.displayName} {platform2.side} : {formatPrice(latestPoint.platform2Price)}
            </span>
          </div>
        </div>
      )}

      {/* Pulse animation */}
      <style jsx>{`
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.2);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
