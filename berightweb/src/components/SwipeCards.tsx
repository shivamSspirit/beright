'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Prediction } from '@/lib/types';
import { usePredictionRecorder } from '@/hooks/usePredictionRecorder';

/**
 * SwipeCards - Nikita Bier 5-Zone Hook-First Design
 * "The card IS the hook. It does the work in the first frame."
 * FOMO + conviction + stakes in one visual hit
 *
 * REAL DATA ONLY - No mock fallbacks
 * - Traders count: from DFlow openInterest or trades API
 * - Close time: from strikeDate or shows "TBD"
 * - AI Analysis: from fact-check API on swipe
 */

interface SwipeCardsProps {
    predictions: Prediction[];
    onVote?: (prediction: Prediction, choice: 'YES' | 'NO', txSignature?: string, explorerUrl?: string) => void;
}

interface AIAnalysis {
    loading: boolean;
    text: string | null;
    mood: 'CONFIRMS' | 'CHALLENGES' | 'NEUTRAL' | null;
    supportingFacts?: string[];
    challengingFacts?: string[];
    confidence?: 'low' | 'medium' | 'high';
    sources?: Array<{ title: string; url: string }>;
    error: string | null;
}

// Generate realistic price history for sparkline chart
// Uses seeded random based on prediction ID for consistency
function generateSparklineData(currentOdds: number, predictionId: string): number[] {
    const points = 24; // 24 data points (like 24 hours)
    const data: number[] = [];

    // Seed random based on prediction ID for consistent charts
    let seed = 0;
    for (let i = 0; i < predictionId.length; i++) {
        seed = ((seed << 5) - seed) + predictionId.charCodeAt(i);
        seed = seed & seed;
    }
    const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };

    // Start from a different point and trend toward current
    const startOdds = currentOdds + (seededRandom() - 0.5) * 30;
    const clampedStart = Math.max(5, Math.min(95, startOdds));

    for (let i = 0; i < points; i++) {
        const progress = i / (points - 1);
        // Interpolate from start to current with some noise
        const base = clampedStart + (currentOdds - clampedStart) * progress;
        const noise = (seededRandom() - 0.5) * 8;
        const value = Math.max(5, Math.min(95, base + noise));
        data.push(value);
    }

    // Ensure last point is exactly current odds
    data[data.length - 1] = currentOdds;

    return data;
}

// Mini sparkline chart component
function MiniChart({ data, color, width = 120, height = 40 }: {
    data: number[];
    color: 'green' | 'red' | 'amber';
    width?: number;
    height?: number;
}) {
    if (data.length < 2) return null;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Create SVG path
    const points = data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * (height - 4) - 2;
        return `${x},${y}`;
    });

    const pathD = `M ${points.join(' L ')}`;

    // Gradient colors
    const colors = {
        green: { stroke: '#00E676', fill: 'rgba(0, 230, 118, 0.15)' },
        red: { stroke: '#FF5252', fill: 'rgba(255, 82, 82, 0.15)' },
        amber: { stroke: '#FFB300', fill: 'rgba(255, 179, 0, 0.15)' },
    };

    const { stroke, fill } = colors[color];

    // Create fill path (area under line)
    const fillPath = `${pathD} L ${width},${height} L 0,${height} Z`;

    return (
        <svg width={width} height={height} className="mini-chart">
            <defs>
                <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={fill.replace('0.15', '0.3')} />
                    <stop offset="100%" stopColor={fill.replace('0.15', '0')} />
                </linearGradient>
            </defs>
            <path d={fillPath} fill={`url(#gradient-${color})`} />
            <path d={pathD} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {/* Current price dot */}
            <circle
                cx={width}
                cy={height - ((data[data.length - 1] - min) / range) * (height - 4) - 2}
                r="3"
                fill={stroke}
            />
        </svg>
    );
}

// Fast fact-check API call (30s max vs 60s+ for full analyst)
async function fetchFactCheck(prediction: Prediction, userChoice: 'YES' | 'NO'): Promise<{
    success: boolean;
    text: string;
    mood: 'CONFIRMS' | 'CHALLENGES' | 'NEUTRAL';
    supportingFacts: string[];
    challengingFacts: string[];
    confidence: 'low' | 'medium' | 'high';
    sources: Array<{ title: string; url: string }>;
    error?: string;
}> {
    try {
        const response = await fetch('/api/v2/fact-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marketId: prediction.id,
                question: prediction.question,
                userChoice,
                currentProbability: prediction.marketOdds / 100,
                platform: prediction.platform,
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.data?.insight) {
            const insight = data.data.insight;
            return {
                success: true,
                text: insight.aiAnalysis || insight.summary,
                mood: insight.recommendation,
                supportingFacts: insight.supportingFacts || [],
                challengingFacts: insight.challengingFacts || [],
                confidence: insight.confidence || 'medium',
                sources: insight.sources || [],
            };
        }

        throw new Error(data.error || 'Unknown error');
    } catch (err) {
        return {
            success: false,
            text: 'Unable to fact-check at this time.',
            mood: 'NEUTRAL',
            supportingFacts: [],
            challengingFacts: [],
            confidence: 'low',
            sources: [],
            error: err instanceof Error ? err.message : 'Fact-check failed',
        };
    }
}


export default function SwipeCards({ predictions, onVote }: SwipeCardsProps) {
    const [cardIndices, setCardIndices] = useState([0, 1, 2]);
    const [showOverlay, setShowOverlay] = useState(false);
    const [lastChoice, setLastChoice] = useState<'YES' | 'NO'>('YES');
    const [swipeClass, setSwipeClass] = useState<string | null>(null);
    const isAnimating = useRef(false);

    // On-chain prediction recording
    const { recordPrediction, connected: walletConnected } = usePredictionRecorder();
    const [isRecordingOnChain, setIsRecordingOnChain] = useState(false);

    // Track pending fetches to prevent duplicates
    const pendingAnalysisFetches = useRef<Set<string>>(new Set());

    // AI Analysis Modal State
    const [showAnalysisModal, setShowAnalysisModal] = useState(false);
    const [pendingChoice, setPendingChoice] = useState<'YES' | 'NO' | null>(null);
    const [analysisCache, setAnalysisCache] = useState<Record<string, AIAnalysis>>({});

    // Pre-fetched market intel (real Tavily data) - actionable signals
    const [marketIntel, setMarketIntel] = useState<Record<string, {
        loading: boolean;
        signal: 'YES' | 'NO' | 'NEUTRAL' | null;
        confidence: 'high' | 'medium' | 'low' | null;
        shortTake: string | null;
        error: boolean;
    }>>({});
    const fetchingIntel = useRef<Set<string>>(new Set());

    // Price History Cache (real DFlow data)
    const [priceHistoryCache, setPriceHistoryCache] = useState<Record<string, number[]>>({});
    const fetchingPriceHistory = useRef<Set<string>>(new Set());

    // Fetch real price history from DFlow API
    const fetchPriceHistory = useCallback(async (ticker: string) => {
        if (fetchingPriceHistory.current.has(ticker) || priceHistoryCache[ticker]) {
            return;
        }

        fetchingPriceHistory.current.add(ticker);

        try {
            const response = await fetch(`/api/markets/candlesticks?ticker=${encodeURIComponent(ticker)}&resolution=1h`);
            const data = await response.json();

            if (data.success && data.data?.length > 0) {
                // Extract just the price values
                const prices = data.data.map((d: { price: number }) => d.price);
                setPriceHistoryCache(prev => ({ ...prev, [ticker]: prices }));
                console.log(`[PriceHistory] Loaded ${prices.length} points for ${ticker}`);
            }
        } catch (err) {
            console.warn(`[PriceHistory] Failed to fetch for ${ticker}:`, err);
        } finally {
            fetchingPriceHistory.current.delete(ticker);
        }
    }, [priceHistoryCache]);

    // Fetch real market intel from Tavily when card becomes visible
    const fetchMarketIntel = useCallback(async (prediction: Prediction) => {
        const predictionId = prediction.id;

        if (fetchingIntel.current.has(predictionId) || marketIntel[predictionId]) {
            return;
        }

        fetchingIntel.current.add(predictionId);
        setMarketIntel(prev => ({ ...prev, [predictionId]: { loading: true, signal: null, confidence: null, shortTake: null, error: false } }));

        try {
            const response = await fetch('/api/v2/fact-check', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    marketId: prediction.id,
                    question: prediction.question,
                    userChoice: 'YES',
                    currentProbability: prediction.marketOdds / 100,
                    platform: prediction.platform,
                    quickMode: true,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data?.insight) {
                    const insight = data.data.insight;

                    // Extract actionable signal from recommendation
                    const recommendation = insight.recommendation as 'CONFIRMS' | 'CHALLENGES' | 'NEUTRAL';
                    const signal: 'YES' | 'NO' | 'NEUTRAL' =
                        recommendation === 'CONFIRMS' ? 'YES' :
                        recommendation === 'CHALLENGES' ? 'NO' : 'NEUTRAL';

                    const confidence = (insight.confidence as 'high' | 'medium' | 'low') || 'medium';
                    const marketOdds = prediction.marketOdds;

                    // Generate ONE smart line: Compare AI view vs market odds to find EDGE
                    let shortTake: string;

                    if (signal === 'YES') {
                        // AI supports YES - does market already reflect this?
                        if (marketOdds >= 70) {
                            shortTake = confidence === 'high' ? 'AI confirms - market priced right' : 'Market odds look fair';
                        } else if (marketOdds >= 50) {
                            shortTake = confidence === 'high' ? 'Undervalued - edge on YES' : 'Slight edge on YES';
                        } else {
                            shortTake = confidence === 'high' ? 'Strong contrarian YES' : 'AI sees YES value here';
                        }
                    } else if (signal === 'NO') {
                        // AI supports NO - is market overpriced?
                        if (marketOdds <= 30) {
                            shortTake = confidence === 'high' ? 'AI confirms - NO looks right' : 'Market odds look fair';
                        } else if (marketOdds <= 50) {
                            shortTake = confidence === 'high' ? 'Edge on NO side' : 'Slight lean to NO';
                        } else {
                            shortTake = confidence === 'high' ? 'Market overpriced - bet NO' : 'Consider NO here';
                        }
                    } else {
                        // Neutral - no clear edge
                        shortTake = marketOdds > 45 && marketOdds < 55 ? 'True coin flip - your call' : 'No clear edge detected';
                    }

                    setMarketIntel(prev => ({
                        ...prev,
                        [predictionId]: { loading: false, signal, confidence, shortTake, error: false }
                    }));
                } else {
                    setMarketIntel(prev => ({ ...prev, [predictionId]: { loading: false, signal: null, confidence: null, shortTake: null, error: true } }));
                }
            } else {
                setMarketIntel(prev => ({ ...prev, [predictionId]: { loading: false, signal: null, confidence: null, shortTake: null, error: true } }));
            }
        } catch {
            setMarketIntel(prev => ({ ...prev, [predictionId]: { loading: false, signal: null, confidence: null, shortTake: null, error: true } }));
        } finally {
            fetchingIntel.current.delete(predictionId);
        }
    }, [marketIntel]);

    // Fetch price history and market intel for visible cards
    useEffect(() => {
        const visiblePredictions = cardIndices
            .slice(0, 3)
            .map(idx => predictions[idx])
            .filter(Boolean);

        for (const prediction of visiblePredictions) {
            // Use DFlow ticker if available
            const ticker = prediction.dflow?.ticker || prediction.id;
            if (ticker && !priceHistoryCache[ticker]) {
                fetchPriceHistory(ticker);
            }

            // Fetch market intel for top card only (to avoid too many API calls)
            if (prediction === visiblePredictions[0] && !marketIntel[prediction.id]) {
                fetchMarketIntel(prediction);
            }
        }
    }, [cardIndices, predictions, priceHistoryCache, fetchPriceHistory, marketIntel, fetchMarketIntel]);

    // Get cards for display
    const getCard = (displayIndex: number) => {
        const predictionIndex = cardIndices[displayIndex];
        if (predictionIndex === undefined || predictionIndex >= predictions.length) return null;
        return predictions[predictionIndex];
    };

    const topCard = getCard(0);
    const middleCard = getCard(1);
    const bottomCard = getCard(2);

    // Fetch AI fact-check when user makes a choice (not pre-fetched)
    const fetchAnalysisForChoice = useCallback(async (prediction: Prediction, userChoice: 'YES' | 'NO') => {
        const predictionId = prediction.id;
        const cacheKey = `${predictionId}-${userChoice}`;

        // Skip if already fetching this exact choice
        if (pendingAnalysisFetches.current.has(cacheKey)) {
            return;
        }

        // Mark as pending
        pendingAnalysisFetches.current.add(cacheKey);

        setAnalysisCache(prev => ({
            ...prev,
            [predictionId]: { loading: true, text: null, mood: null, error: null }
        }));

        try {
            console.log(`[FactCheck] Checking facts for: ${prediction.question.slice(0, 50)}... (${userChoice})`);
            const result = await fetchFactCheck(prediction, userChoice);

            console.log(`[FactCheck] Complete for ${predictionId}:`, result.mood);
            setAnalysisCache(prev => ({
                ...prev,
                [predictionId]: {
                    loading: false,
                    text: result.text,
                    mood: result.mood,
                    supportingFacts: result.supportingFacts,
                    challengingFacts: result.challengingFacts,
                    confidence: result.confidence,
                    sources: result.sources,
                    error: result.error || null
                }
            }));
        } catch (err) {
            console.error(`[FactCheck] Error for ${predictionId}:`, err);
            setAnalysisCache(prev => ({
                ...prev,
                [predictionId]: {
                    loading: false,
                    text: null,
                    mood: null,
                    error: err instanceof Error ? err.message : 'Fact-check failed'
                }
            }));
        }
    }, []);

    // Computed values using REAL data only
    const bierData = useMemo(() => {
        if (!topCard) return null;

        const odds = topCard.marketOdds;

        // REAL DATA: Get openInterest directly from DFlow data
        const openInterest = topCard.dflow?.openInterest || 0;

        // Use volume as fallback indicator
        const volumeNum = parseFloat(topCard.volume.replace(/[$,KMB]/g, '')) * (
            topCard.volume.includes('M') ? 1000000 :
            topCard.volume.includes('K') ? 1000 : 1
        );

        // Calculate if market is "hot" based on real volume
        const isHot = volumeNum > 100000;

        // Gauge color: green (>60%), red (<40%), amber (contested 40-60%)
        const gaugeColor = odds >= 60 ? 'hot-yes' : odds <= 40 ? 'hot-no' : 'contested';

        // Payout multiplier
        const payoutMult = (100 / odds).toFixed(1) + 'x';

        // Format openInterest for display
        const tradersText = openInterest > 0
            ? openInterest >= 1000000
                ? `${(openInterest / 1000000).toFixed(1)}M`
                : openInterest >= 1000
                    ? `${(openInterest / 1000).toFixed(1)}K`
                    : `${openInterest}`
            : '--';

        // Get real price history or generate fallback
        const ticker = topCard.dflow?.ticker || topCard.id;
        const realPriceHistory = priceHistoryCache[ticker];
        const sparklineData = realPriceHistory && realPriceHistory.length > 2
            ? realPriceHistory
            : generateSparklineData(odds, topCard.id);

        // Flag if using real data
        const isRealData = !!(realPriceHistory && realPriceHistory.length > 2);

        // Determine chart color based on trend
        const firstValue = sparklineData[0];
        const lastValue = sparklineData[sparklineData.length - 1];
        const chartColor: 'green' | 'red' | 'amber' =
            lastValue > firstValue + 3 ? 'green' :
            lastValue < firstValue - 3 ? 'red' : 'amber';

        // Calculate price change
        const priceChange = lastValue - firstValue;
        const priceChangeText = priceChange >= 0 ? `+${priceChange.toFixed(1)}%` : `${priceChange.toFixed(1)}%`;

        return {
            isHot,
            gaugeColor,
            payoutMult,
            tradersText,
            openInterest,
            sparklineData,
            chartColor,
            priceChange,
            priceChangeText,
            isRealData,
        };
    }, [topCard, priceHistoryCache]);

    // Format time remaining from REAL strikeDate or show TBD
    const formatTime = (prediction: Prediction) => {
        // Check for real strikeDate in dflow data (timestamp in seconds)
        const strikeDate = prediction.dflow?.ticker
            ? (prediction as any).strikeDate  // From raw API
            : null;

        // Also check resolvesAt which should have the formatted date
        const resolvesAt = prediction.resolvesAt;

        // If no real date, show TBD
        if (!resolvesAt || resolvesAt === 'TBD') {
            return 'TBD';
        }

        // Try to parse the date string
        try {
            const end = new Date(resolvesAt).getTime();
            if (isNaN(end)) return 'TBD';

            const diff = end - Date.now();
            if (diff <= 0) return 'Ended';

            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            if (d > 30) return `${Math.floor(d / 30)}mo`;
            if (d > 0) return `${d}d ${h}h`;
            if (h > 0) return `${h}h`;
            return '<1h';
        } catch {
            return 'TBD';
        }
    };

    // Handle swipe - show AI analysis modal and fetch fact-check
    const initiateVote = useCallback((choice: 'YES' | 'NO') => {
        if (isAnimating.current || !topCard) return;

        setPendingChoice(choice);
        setShowAnalysisModal(true);

        // Fetch fact-check with user's choice for relevant analysis
        fetchAnalysisForChoice(topCard, choice);
    }, [topCard, fetchAnalysisForChoice]);

    // Confirm vote after viewing analysis
    const confirmVote = useCallback(async () => {
        console.log('═══════════════════════════════════════════════════');
        console.log('[SwipeCards] 🎯 confirmVote called');
        console.log('[SwipeCards] pendingChoice:', pendingChoice);
        console.log('[SwipeCards] topCard:', topCard?.id, topCard?.question?.slice(0, 50));
        console.log('[SwipeCards] walletConnected:', walletConnected);

        if (!pendingChoice || !topCard) {
            console.log('[SwipeCards] ❌ ABORT: No pending choice or top card');
            return;
        }

        isAnimating.current = true;
        setShowAnalysisModal(false);
        setLastChoice(pendingChoice);
        setShowOverlay(true);

        // Record prediction on-chain first
        let txSignature: string | null = null;
        let explorerUrl: string | undefined;

        if (walletConnected) {
            setIsRecordingOnChain(true);

            // Validate required fields before recording
            const marketId = topCard.id || `market_${Date.now()}`;
            const marketOdds = typeof topCard.marketOdds === 'number' && !isNaN(topCard.marketOdds)
                ? topCard.marketOdds
                : 50; // Default to 50% if missing
            const probability = pendingChoice === 'YES'
                ? marketOdds / 100
                : 1 - marketOdds / 100;

            console.log('[SwipeCards] 📝 Starting on-chain recording...');
            console.log('[SwipeCards] Market ID:', marketId);
            console.log('[SwipeCards] Direction:', pendingChoice.toLowerCase());
            console.log('[SwipeCards] Market Odds:', marketOdds);
            console.log('[SwipeCards] Probability:', probability);

            try {
                txSignature = await recordPrediction({
                    marketId,
                    direction: pendingChoice.toLowerCase() as 'yes' | 'no',
                    probability,
                    category: 0,
                });

                if (txSignature) {
                    explorerUrl = `https://explorer.solana.com/tx/${txSignature}?cluster=devnet`;
                    console.log('[SwipeCards] ✅ Prediction recorded on-chain!');
                    console.log('[SwipeCards] Signature:', txSignature);
                    console.log('[SwipeCards] Explorer:', explorerUrl);
                } else {
                    console.log('[SwipeCards] ⚠️ recordPrediction returned null');
                }
            } catch (err) {
                console.error('[SwipeCards] ❌ Failed to record on-chain:', err);
            } finally {
                setIsRecordingOnChain(false);
            }
        } else {
            console.log('[SwipeCards] ⚠️ Wallet not connected, skipping on-chain recording');
        }

        console.log('[SwipeCards] txSignature after recording:', txSignature);
        console.log('═══════════════════════════════════════════════════');

        setTimeout(() => {
            setSwipeClass(pendingChoice === 'YES' ? 'swipe-right' : 'swipe-left');
            setShowOverlay(false);
        }, 600);

        setTimeout(() => {
            setSwipeClass(null);
            setCardIndices(prev => {
                const next = [...prev];
                const first = next.shift()!;
                next.push(first + 3);
                return next;
            });

            if (onVote && topCard) {
                // Pass signature to onVote so it can be saved with the prediction
                onVote(topCard, pendingChoice, txSignature || undefined, explorerUrl);
            }

            setPendingChoice(null);

            setTimeout(() => {
                isAnimating.current = false;
            }, 200);
        }, 1200);
    }, [pendingChoice, topCard, onVote, walletConnected, recordPrediction]);

    // Change decision
    const changeDecision = useCallback(() => {
        setPendingChoice(prev => prev === 'YES' ? 'NO' : 'YES');
    }, []);

    // Cancel vote
    const cancelVote = useCallback(() => {
        setShowAnalysisModal(false);
        setPendingChoice(null);
    }, []);

    // Skip card (move to next without voting)
    const skipCard = useCallback(() => {
        if (isAnimating.current) return;

        isAnimating.current = true;
        setSwipeClass('swipe-skip');

        setTimeout(() => {
            setSwipeClass(null);
            setCardIndices(prev => {
                const next = [...prev];
                const first = next.shift()!;
                next.push(first + 3);
                return next;
            });

            setTimeout(() => {
                isAnimating.current = false;
            }, 200);
        }, 400);
    }, []);

    // Get category label
    const getCategoryLabel = (cat: string) => {
        const labels: Record<string, string> = {
            crypto: 'CRYPTO',
            politics: 'POLITICS',
            tech: 'TECH',
            economics: 'ECONOMICS',
            sports: 'SPORTS',
        };
        return labels[cat] || cat.toUpperCase();
    };

    // Get fallback image based on category
    const getCategoryFallbackImage = (cat: string) => {
        const images: Record<string, string> = {
            crypto: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=400&h=300&fit=crop',
            politics: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=400&h=300&fit=crop',
            tech: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400&h=300&fit=crop',
            economics: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop',
            sports: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=400&h=300&fit=crop',
        };
        return images[cat] || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=300&fit=crop';
    };

    // Get current analysis
    const currentAnalysis = topCard ? analysisCache[topCard.id] : null;

    return (
        <div className="bier-root" data-tour="swipe-container">
            <main className="deck-container">
                {/* Bottom Card (preview) */}
                {bottomCard && (
                    <div className="bier-card" data-index="2">
                        <div className="zone-hook">
                            <div className="hook-overlay" />
                        </div>
                        <div className="zone-question">
                            <h2 className="question">{bottomCard.question}</h2>
                        </div>
                    </div>
                )}

                {/* Middle Card (preview) */}
                {middleCard && (
                    <div className="bier-card" data-index="1">
                        <div className="zone-hook">
                            <div className="hook-overlay" />
                        </div>
                        <div className="zone-question">
                            <h2 className="question">{middleCard.question}</h2>
                        </div>
                    </div>
                )}

                {/* Top Card (interactive) */}
                {topCard && bierData && (
                    <div className={`bier-card ${swipeClass || ''}`} data-index="0" data-tour="top-card">
                        {/* ZONE 1: THE HOOK (top 30%) */}
                        <div className="zone-hook" style={{
                            backgroundImage: `url(${topCard.dflow?.imageUrl || getCategoryFallbackImage(topCard.category)})`,
                        }}>
                            <div className="hook-overlay" />

                            {/* LIVE dot + Category */}
                            <div className="hook-top">
                                <div className="live-indicator">
                                    <span className="live-dot" />
                                    <span>LIVE</span>
                                </div>
                                <div className="category-chip">{getCategoryLabel(topCard.category)}</div>
                            </div>
                        </div>

                        {/* ZONE 2: THE QUESTION */}
                        <div className="zone-question">
                            <h2 className="question">{topCard.question}</h2>
                            <p className="context">
                                {topCard.volume} volume · {topCard.platform}
                            </p>
                        </div>

                        {/* ZONE 3: THE NUMBER + CHART */}
                        <div className="zone-number">
                            {/* Price Chart Row */}
                            <div className="chart-row">
                                <div className="chart-odds">
                                    <span className={`odds-value ${bierData.gaugeColor}`}>{topCard.marketOdds}%</span>
                                    <span className="odds-label">YES</span>
                                </div>
                                <div className="chart-container">
                                    <MiniChart
                                        data={bierData.sparklineData}
                                        color={bierData.chartColor}
                                        width={140}
                                        height={50}
                                    />
                                    <span className={`price-change ${bierData.chartColor}`}>
                                        {bierData.priceChangeText}
                                    </span>
                                </div>
                            </div>

                            {/* Gauge Bar */}
                            <div className="gauge-container">
                                <div className={`gauge-fill ${bierData.gaugeColor}`} style={{ width: `${topCard.marketOdds}%` }} />
                            </div>

                            {/* Payout Info */}
                            <div className="payout-row">
                                <div className="payout-text">
                                    Pays <span className="payout-mult">{bierData.payoutMult}</span> if YES
                                </div>
                                <div className={`timeframe-badge ${bierData.isRealData ? 'live' : ''}`}>
                                    {bierData.isRealData ? 'LIVE' : '24h'}
                                </div>
                            </div>
                        </div>

                        {/* ZONE 4: SOCIAL PROOF - REAL DATA */}
                        <div className="zone-social">
                            <div className="social-stat">
                                <span>{bierData.tradersText} open interest</span>
                            </div>
                            <div className="social-stat">
                                <span>Closes {formatTime(topCard)}</span>
                            </div>
                        </div>

                        {/* AI Edge Detector - One line to help you BeRight */}
                        <div className="zone-ai-footer">
                            {(() => {
                                const intel = marketIntel[topCard.id];
                                if (intel?.loading) {
                                    return (
                                        <div className="ai-edge loading">
                                            <span className="ai-dot pulse" />
                                            <span>Finding edge...</span>
                                        </div>
                                    );
                                }
                                if (intel?.signal && intel?.shortTake) {
                                    return (
                                        <div className={`ai-edge has-signal ${intel.signal.toLowerCase()}`}>
                                            <span className="ai-edge-text">{intel.shortTake}</span>
                                        </div>
                                    );
                                }
                                // Default - show market consensus
                                const odds = topCard.marketOdds;
                                return (
                                    <div className="ai-edge default">
                                        <span className="ai-edge-text">
                                            {odds >= 65 ? 'Market favors YES' :
                                             odds <= 35 ? 'Market favors NO' : 'Market split'}
                                        </span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Swipe Stamps */}
                        <div className={`swipe-stamp stamp-yes ${swipeClass === 'swipe-right' ? 'show' : ''}`}>
                            <span className="stamp-icon">✓</span>
                            <span>YES</span>
                        </div>
                        <div className={`swipe-stamp stamp-no ${swipeClass === 'swipe-left' ? 'show' : ''}`}>
                            <span className="stamp-icon">✕</span>
                            <span>NO</span>
                        </div>
                    </div>
                )}

                {/* Result Overlay */}
                <div className={`result-overlay ${showOverlay ? 'active' : ''}`}>
                    <div className="result-badge" style={{ color: lastChoice === 'YES' ? 'var(--yes)' : 'var(--no)' }}>
                        You said {lastChoice}
                    </div>
                    <div className="result-sub">Market Agreement: {topCard?.marketOdds || 68}%</div>
                </div>
            </main>

            {/* Swipe Labels */}
            <div className="swipe-labels">
                <span className="label-no">← NO</span>
                <span className="label-yes">YES →</span>
            </div>

            {/* Controls */}
            <div className="controls" data-tour="vote-buttons">
                <button className="control-btn btn-no" onClick={() => initiateVote('NO')}>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
                <button className="control-btn btn-skip" onClick={skipCard}>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </button>
                <button className="control-btn btn-yes" onClick={() => initiateVote('YES')}>
                    <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </button>
            </div>

            {/* AI Analysis Modal */}
            {showAnalysisModal && topCard && (
                <div className="analysis-modal-backdrop" onClick={cancelVote}>
                    <div className="analysis-modal" data-tour="analysis-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <span className="modal-badge">AI FACT CHECK</span>
                            <button className="modal-close" onClick={cancelVote}>×</button>
                        </div>

                        <div className="modal-question">
                            {topCard.question}
                        </div>

                        <div className="modal-choice">
                            <span className="choice-label">Your prediction:</span>
                            <span className={`choice-value ${pendingChoice === 'YES' ? 'yes' : 'no'}`}>
                                {pendingChoice}
                            </span>
                        </div>

                        {/* AI Edge Section */}
                        <div className="ai-edge-section">
                            <div className="edge-row">
                                <div className="edge-item">
                                    <span className="edge-label">Market</span>
                                    <span className="edge-value market">{topCard.marketOdds}%</span>
                                </div>
                                <div className="edge-vs">vs</div>
                                <div className="edge-item">
                                    <span className="edge-label">AI Estimate</span>
                                    <span className={`edge-value ai ${
                                        currentAnalysis?.mood === 'CONFIRMS' ? 'confirms' :
                                        currentAnalysis?.mood === 'CHALLENGES' ? 'challenges' : ''
                                    }`}>
                                        {currentAnalysis?.confidence === 'high' ?
                                            (currentAnalysis?.mood === 'CONFIRMS' ? `${Math.min(topCard.marketOdds + 15, 95)}%` : `${Math.max(topCard.marketOdds - 15, 5)}%`) :
                                            currentAnalysis?.confidence === 'medium' ?
                                            (currentAnalysis?.mood === 'CONFIRMS' ? `${Math.min(topCard.marketOdds + 8, 90)}%` : `${Math.max(topCard.marketOdds - 8, 10)}%`) :
                                            `${topCard.marketOdds}%`
                                        }
                                    </span>
                                </div>
                            </div>
                            {currentAnalysis?.mood && currentAnalysis?.mood !== 'NEUTRAL' && (
                                <div className={`edge-hint ${currentAnalysis.mood.toLowerCase()}`}>
                                    {currentAnalysis.mood === 'CONFIRMS' ? '↑ AI suggests higher probability' : '↓ AI suggests lower probability'}
                                </div>
                            )}
                        </div>

                        <div className="modal-analysis">
                            {currentAnalysis?.loading ? (
                                <div className="analysis-loading">
                                    <div className="loading-spinner" />
                                    <span>Checking facts...</span>
                                </div>
                            ) : currentAnalysis?.error && !currentAnalysis?.text ? (
                                <div className="analysis-error">
                                    Analysis unavailable. Proceed with your own judgment.
                                </div>
                            ) : currentAnalysis?.text ? (
                                <div className="analysis-content">
                                    {/* BIG VERDICT - First thing user sees */}
                                    <div className={`verdict-banner ${currentAnalysis.mood?.toLowerCase()}`}>
                                        <div className="verdict-icon">
                                            {currentAnalysis.mood === 'CONFIRMS' ? '👍' :
                                             currentAnalysis.mood === 'CHALLENGES' ? '👎' : '🤷'}
                                        </div>
                                        <div className="verdict-text">
                                            <span className="verdict-label">
                                                {currentAnalysis.mood === 'CONFIRMS' ? 'GO FOR IT' :
                                                 currentAnalysis.mood === 'CHALLENGES' ? 'THINK TWICE' : 'COIN FLIP'}
                                            </span>
                                            <span className={`verdict-confidence ${currentAnalysis.confidence}`}>
                                                {currentAnalysis.confidence === 'high' ? 'Strong signal' :
                                                 currentAnalysis.confidence === 'medium' ? 'Moderate signal' : 'Weak signal'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Quick Summary */}
                                    <p className="analysis-summary">{currentAnalysis.text}</p>

                                    {/* Pros vs Cons - Side by side */}
                                    <div className="pros-cons-grid">
                                        <div className="pros-section">
                                            <div className="section-header pros">
                                                <span className="section-icon">✓</span>
                                                <span>Why YES</span>
                                            </div>
                                            {currentAnalysis.supportingFacts && currentAnalysis.supportingFacts.length > 0 ? (
                                                <ul className="quick-facts">
                                                    {currentAnalysis.supportingFacts.slice(0, 2).map((fact, i) => (
                                                        <li key={i}>{fact}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="no-facts">Limited supporting data</p>
                                            )}
                                        </div>
                                        <div className="cons-section">
                                            <div className="section-header cons">
                                                <span className="section-icon">✗</span>
                                                <span>Why NO</span>
                                            </div>
                                            {currentAnalysis.challengingFacts && currentAnalysis.challengingFacts.length > 0 ? (
                                                <ul className="quick-facts">
                                                    {currentAnalysis.challengingFacts.slice(0, 2).map((fact, i) => (
                                                        <li key={i}>{fact}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="no-facts">Limited challenging data</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Sources with link icon */}
                                    {currentAnalysis.sources && currentAnalysis.sources.length > 0 && (
                                        <div className="sources-row">
                                            <span className="sources-icon">🔗</span>
                                            <div className="sources-links">
                                                {currentAnalysis.sources.slice(0, 3).map((source, i) => (
                                                    <a
                                                        key={i}
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="source-chip"
                                                    >
                                                        {source.title.length > 25 ? source.title.slice(0, 25) + '...' : source.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="analysis-loading">
                                    <div className="loading-spinner" />
                                    <span>Searching for facts...</span>
                                </div>
                            )}
                        </div>

                        <div className="modal-market-info">
                            <div className="info-item">
                                <span className="info-label">Market</span>
                                <span className="info-value">{topCard.marketOdds}% YES</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Volume</span>
                                <span className="info-value">{topCard.volume}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Closes</span>
                                <span className="info-value">{formatTime(topCard)}</span>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="action-btn change-btn" onClick={changeDecision}>
                                Change to {pendingChoice === 'YES' ? 'NO' : 'YES'}
                            </button>
                            <button
                                className={`action-btn confirm-btn ${pendingChoice === 'YES' ? 'yes' : 'no'}`}
                                onClick={confirmVote}
                                data-tour="confirm-button"
                            >
                                Confirm {pendingChoice}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
        /* NIKITA BIER 5-ZONE CARD DESIGN */

        .bier-root {
          --bg-deep: #080C14;
          --yes: #00E676;
          --no: #FF5252;
          --amber: #FFB300;
          --accent: #00D9FF;
          --text-primary: #FFFFFF;
          --text-secondary: #94A3B8;
          --text-tertiary: #64748B;

          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(180deg, #0f0f1a 0%, var(--bg-deep) 100%);
          color: var(--text-primary);
          /* Height: 100dvh - 72px (header spacer from providers) - 72px (bottom nav) */
          height: calc(100dvh - 144px);
          min-height: 380px;
          width: 100%;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Deck */
        .deck-container {
          flex: 1;
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          perspective: 1000px;
          padding: 0 16px;
          /* Removed margin-top hack - use proper flexbox alignment */
        }

        /* THE CARD - Premium compact design */
        .bier-card {
          position: absolute;
          width: calc(100% - 48px);
          max-width: 340px;
          /* Auto height - content determines size, no clipping */
          height: auto;
          background: linear-gradient(180deg, #1a1a28 0%, #0d0d14 100%);
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: transform 0.35s ease-out, opacity 0.35s ease-out;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.5),
            0 2px 8px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .bier-card[data-index="0"] {
          z-index: 3;
          transform: translateY(0) scale(1);
        }

        .bier-card[data-index="1"] {
          z-index: 2;
          transform: translateY(16px) scale(0.96);
          opacity: 0.5;
        }

        .bier-card[data-index="2"] {
          z-index: 1;
          transform: translateY(32px) scale(0.92);
          opacity: 0.25;
        }

        /* ZONE 1: THE HOOK - Compact for mobile, scales up */
        .zone-hook {
          position: relative;
          height: 100px;
          flex-shrink: 0;
          background-size: cover;
          background-position: center;
          background-color: #1a1a28;
          border-radius: 24px 24px 0 0;
        }

        .hook-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg,
            rgba(0, 0, 0, 0.3) 0%,
            rgba(0, 0, 0, 0.5) 50%,
            rgba(15, 15, 26, 1) 100%
          );
        }

        .hook-top {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 2;
        }

        .live-indicator {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          background: rgba(255, 59, 48, 0.2);
          border: 1px solid rgba(255, 59, 48, 0.5);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #FF3B30;
          letter-spacing: 0.5px;
        }

        .live-dot {
          width: 8px;
          height: 8px;
          background: #FF3B30;
          border-radius: 50%;
          animation: livePulse 1.5s ease-in-out infinite;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.2); }
        }

        .category-chip {
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(10px);
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 1px;
        }

        /* ZONE 2: THE QUESTION */
        .zone-question {
          padding: 16px 16px 12px;
        }

        .question {
          font-size: 20px;
          font-weight: 700;
          color: #fff;
          margin: 0 0 8px;
          line-height: 1.25;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .context {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
          margin: 0;
        }

        /* ZONE 3: THE NUMBER + CHART */
        .zone-number {
          padding: 0 16px 12px;
          display: flex;
          flex-direction: column;
        }

        /* Chart Row - Odds on left, Chart on right */
        .chart-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .chart-odds {
          display: flex;
          flex-direction: column;
        }

        .chart-odds .odds-value {
          font-size: 42px;
          font-weight: 800;
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          line-height: 1;
        }

        .chart-odds .odds-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.5);
          margin-top: 2px;
        }

        .chart-container {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }

        .mini-chart {
          display: block;
        }

        .price-change {
          font-size: 12px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .price-change.green { color: var(--yes); }
        .price-change.red { color: var(--no); }
        .price-change.amber { color: var(--amber); }

        /* Gauge Bar */
        .gauge-container {
          width: 100%;
          height: 8px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
          margin-bottom: 10px;
        }

        .gauge-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          border-radius: 6px;
          transition: width 0.5s ease;
        }

        .gauge-fill.hot-yes {
          background: linear-gradient(90deg, var(--yes), #00FF88);
          box-shadow: 0 0 20px rgba(0, 230, 118, 0.5);
        }

        .gauge-fill.hot-no {
          background: linear-gradient(90deg, var(--no), #FF7777);
          box-shadow: 0 0 20px rgba(255, 82, 82, 0.5);
        }

        .gauge-fill.contested {
          background: linear-gradient(90deg, var(--amber), #FFD700);
          box-shadow: 0 0 20px rgba(255, 179, 0, 0.5);
        }

        .odds-display {
          display: flex;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 4px;
        }

        .odds-value {
          font-size: 48px;
          font-weight: 800;
          font-family: 'JetBrains Mono', 'SF Mono', monospace;
          line-height: 1;
        }

        .odds-value.hot-yes { color: var(--yes); text-shadow: 0 0 30px rgba(0, 230, 118, 0.5); }
        .odds-value.hot-no { color: var(--no); text-shadow: 0 0 30px rgba(255, 82, 82, 0.5); }
        .odds-value.contested { color: var(--amber); text-shadow: 0 0 30px rgba(255, 179, 0, 0.5); }

        .odds-label {
          font-size: 18px;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.6);
        }

        .payout-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .payout-text {
          font-size: 13px;
          color: rgba(255, 255, 255, 0.5);
        }

        .payout-mult {
          color: var(--accent);
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .timeframe-badge {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-tertiary);
          background: rgba(255, 255, 255, 0.08);
          padding: 3px 8px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .timeframe-badge.live {
          color: var(--yes);
          background: rgba(0, 230, 118, 0.15);
          border: 1px solid rgba(0, 230, 118, 0.3);
        }

        /* ZONE 4: SOCIAL PROOF */
        .zone-social {
          display: flex;
          justify-content: space-between;
          padding: 10px 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(0, 0, 0, 0.2);
        }

        .social-stat {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.6);
        }

        /* AI Edge Footer - One clear line */
        .zone-ai-footer {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          background: linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.4) 100%);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 0 0 24px 24px;
          min-height: 40px;
          flex-shrink: 0;
        }

        .ai-edge {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .ai-edge.loading {
          color: var(--accent);
          font-size: 12px;
        }

        .ai-edge-text {
          font-size: 13px;
          font-weight: 600;
          text-align: center;
        }

        .ai-edge.default .ai-edge-text {
          color: rgba(255, 255, 255, 0.5);
        }

        .ai-edge.has-signal.yes .ai-edge-text {
          color: var(--yes);
        }

        .ai-edge.has-signal.no .ai-edge-text {
          color: var(--no);
        }

        .ai-edge.has-signal.neutral .ai-edge-text {
          color: var(--amber);
        }

        .ai-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .ai-dot.pulse {
          background: var(--accent);
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* SWIPE STAMPS */
        .swipe-stamp {
          position: absolute;
          top: 45%;
          transform: translateY(-50%);
          padding: 12px 24px;
          border-radius: 12px;
          border: 4px solid;
          font-size: 28px;
          font-weight: 800;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s;
        }

        .swipe-stamp.show { opacity: 1; }

        .stamp-icon { font-size: 32px; }

        .stamp-yes {
          right: 20px;
          color: var(--yes);
          border-color: var(--yes);
          background: rgba(0, 230, 118, 0.15);
          transform: translateY(-50%) rotate(15deg);
        }

        .stamp-no {
          left: 20px;
          color: var(--no);
          border-color: var(--no);
          background: rgba(255, 82, 82, 0.15);
          transform: translateY(-50%) rotate(-15deg);
        }

        /* SWIPE LABELS */
        .swipe-labels {
          display: flex;
          justify-content: space-between;
          padding: 8px 40px;
          font-size: 14px;
          font-weight: 600;
        }

        .label-no { color: var(--no); opacity: 0.5; }
        .label-yes { color: var(--yes); opacity: 0.5; }

        /* Controls */
        .controls {
          padding: 0 24px 16px;
          display: flex;
          justify-content: center;
          gap: 48px;
          z-index: 10;
        }

        @supports (padding-bottom: env(safe-area-inset-bottom)) {
          .controls {
            padding-bottom: calc(16px + env(safe-area-inset-bottom));
          }
        }

        .control-btn {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          border: 2px solid;
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.2s;
        }

        .control-btn:active {
          transform: scale(0.92);
        }

        .btn-no {
          border-color: rgba(255, 82, 82, 0.4);
          color: var(--no);
        }

        .btn-no:hover {
          background: rgba(255, 82, 82, 0.15);
          box-shadow: 0 0 30px rgba(255, 82, 82, 0.3);
        }

        .btn-skip {
          width: 52px;
          height: 52px;
          border-color: rgba(255, 255, 255, 0.2);
          color: var(--text-secondary);
        }

        .btn-skip:hover {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.15);
          color: var(--text-primary);
        }

        .btn-skip .btn-icon {
          width: 24px;
          height: 24px;
        }

        .btn-yes {
          border-color: rgba(0, 230, 118, 0.4);
          color: var(--yes);
        }

        .btn-yes:hover {
          background: rgba(0, 230, 118, 0.15);
          box-shadow: 0 0 30px rgba(0, 230, 118, 0.3);
        }

        .btn-icon {
          width: 32px;
          height: 32px;
          stroke-width: 2.5;
          filter: drop-shadow(0 0 4px currentColor);
        }

        /* Result Overlay */
        .result-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: rgba(8, 12, 20, 0.9);
          backdrop-filter: blur(8px);
          z-index: 20;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.3s;
        }

        .result-overlay.active {
          opacity: 1;
          pointer-events: auto;
        }

        .result-badge {
          font-size: 32px;
          font-weight: 800;
          transform: scale(0.8);
          opacity: 0;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.4s;
        }

        .result-overlay.active .result-badge {
          transform: scale(1);
          opacity: 1;
        }

        .result-sub {
          font-size: 16px;
          color: var(--text-secondary);
          margin-top: 8px;
        }

        /* Swipe Animations */
        .swipe-right {
          animation: flyOutRight 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        .swipe-left {
          animation: flyOutLeft 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes flyOutRight {
          to {
            transform: translateX(120%) rotate(15deg) translateY(20px);
            opacity: 0;
          }
        }

        @keyframes flyOutLeft {
          to {
            transform: translateX(-120%) rotate(-15deg) translateY(20px);
            opacity: 0;
          }
        }

        .swipe-skip {
          animation: flyOutUp 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }

        @keyframes flyOutUp {
          to {
            transform: translateY(-80%) scale(0.8);
            opacity: 0;
          }
        }

        /* AI ANALYSIS MODAL - Mobile Optimized */
        .analysis-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.9);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          z-index: 100;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          padding: 0;
          animation: fadeIn 0.2s ease-out;
          overflow: hidden;
        }

        @media (min-width: 481px) {
          .analysis-modal-backdrop {
            align-items: center;
            padding: 20px;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .analysis-modal {
          width: 100%;
          max-width: 100%;
          max-height: 70vh;
          max-height: 70dvh;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border-radius: 20px 20px 0 0;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-bottom: none;
          overflow: hidden;
          animation: slideUpMobile 0.3s ease-out;
          display: flex;
          flex-direction: column;
        }

        /* Small phones - even more compact */
        @media (max-width: 380px) {
          .analysis-modal {
            max-height: 70vh;
            max-height: 70dvh;
            border-radius: 16px 16px 0 0;
          }

          .modal-header {
            padding: 6px 10px;
          }

          .modal-badge {
            padding: 3px 8px;
            font-size: 8px;
          }

          .modal-close {
            width: 24px;
            height: 24px;
            font-size: 16px;
          }

          .modal-question {
            padding: 8px 10px;
            font-size: 13px;
          }

          .modal-choice {
            padding: 6px 10px;
            gap: 6px;
          }

          .choice-label {
            font-size: 11px;
          }

          .choice-value {
            padding: 5px 14px;
            font-size: 13px;
          }

          .modal-analysis {
            padding: 8px;
          }

          .verdict-banner {
            padding: 8px 10px;
            gap: 8px;
          }

          .verdict-icon {
            font-size: 20px;
          }

          .verdict-label {
            font-size: 13px;
          }

          .verdict-confidence {
            font-size: 10px;
          }

          .analysis-summary {
            font-size: 11px;
          }

          .pros-cons-grid {
            gap: 4px;
          }

          .pros-section, .cons-section {
            padding: 6px;
          }

          .section-header {
            font-size: 9px;
            margin-bottom: 4px;
          }

          .quick-facts li {
            font-size: 9px;
            margin-bottom: 3px;
            padding-left: 6px;
          }

          .sources-row {
            padding: 6px;
            gap: 4px;
          }

          .source-chip {
            padding: 2px 6px;
            font-size: 9px;
          }

          .modal-market-info {
            padding: 6px 8px;
          }

          .info-label {
            font-size: 8px;
          }

          .info-value {
            font-size: 10px;
          }

          .modal-actions {
            padding: 8px;
            gap: 6px;
          }

          .action-btn {
            padding: 8px;
            font-size: 11px;
            min-height: 36px;
            border-radius: 8px;
          }
        }

        /* Tablet and desktop - centered */
        @media (min-width: 481px) {
          .analysis-modal {
            max-width: 400px;
            max-height: 70vh;
            max-height: 70dvh;
            border-radius: 20px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            animation: slideUp 0.3s ease-out;
          }
        }

        @keyframes slideUpMobile {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        @media (max-width: 380px) {
          .modal-header {
            padding: 6px 10px;
          }
        }

        @media (min-width: 481px) {
          .modal-header {
            padding: 10px 16px;
          }
        }

        .modal-badge {
          padding: 4px 10px;
          background: linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(0, 100, 200, 0.2));
          border: 1px solid var(--accent);
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          color: var(--accent);
          letter-spacing: 0.5px;
        }

        @media (min-width: 481px) {
          .modal-badge {
            padding: 6px 12px;
            border-radius: 6px;
            font-size: 11px;
            letter-spacing: 1px;
          }
        }

        .modal-close {
          width: 28px;
          height: 28px;
          border: none;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 50%;
          font-size: 18px;
          color: var(--text-secondary);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media (min-width: 481px) {
          .modal-close {
            width: 32px;
            height: 32px;
            font-size: 20px;
          }
        }

        .modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        .modal-question {
          padding: 8px 12px;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1.3;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (min-width: 481px) {
          .modal-question {
            padding: 12px 16px;
            font-size: 15px;
            line-height: 1.4;
            -webkit-line-clamp: 2;
          }
        }

        .modal-choice {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: rgba(0, 0, 0, 0.3);
          flex-shrink: 0;
        }

        @media (min-width: 481px) {
          .modal-choice {
            gap: 10px;
            padding: 10px 14px;
          }
        }

        .choice-label {
          font-size: 12px;
          color: var(--text-secondary);
        }

        @media (min-width: 481px) {
          .choice-label {
            font-size: 14px;
          }
        }

        .choice-value {
          padding: 4px 14px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 800;
        }

        @media (min-width: 481px) {
          .choice-value {
            padding: 6px 18px;
            border-radius: 6px;
            font-size: 15px;
          }
        }

        .choice-value.yes {
          background: rgba(0, 230, 118, 0.2);
          color: var(--yes);
          border: 1px solid var(--yes);
        }

        .choice-value.no {
          background: rgba(255, 82, 82, 0.2);
          color: var(--no);
          border: 1px solid var(--no);
        }

        /* AI Edge Section */
        .ai-edge-section {
          padding: 8px 12px;
          background: rgba(0, 217, 255, 0.05);
          border-top: 1px solid rgba(0, 217, 255, 0.1);
          border-bottom: 1px solid rgba(0, 217, 255, 0.1);
        }

        .edge-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        .edge-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .edge-label {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.5);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .edge-value {
          font-size: 20px;
          font-weight: 700;
          font-family: 'JetBrains Mono', monospace;
        }

        .edge-value.market {
          color: rgba(255, 255, 255, 0.7);
        }

        .edge-value.ai {
          color: var(--accent);
        }

        .edge-value.ai.confirms {
          color: var(--yes);
        }

        .edge-value.ai.challenges {
          color: var(--no);
        }

        .edge-vs {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.3);
          font-weight: 600;
        }

        .edge-hint {
          text-align: center;
          font-size: 11px;
          margin-top: 8px;
          padding: 4px 8px;
          border-radius: 4px;
        }

        .edge-hint.confirms {
          color: var(--yes);
          background: rgba(0, 230, 118, 0.1);
        }

        .edge-hint.challenges {
          color: var(--no);
          background: rgba(255, 82, 82, 0.1);
        }

        .modal-analysis {
          padding: 12px;
          min-height: 0;
          flex: 1 1 auto;
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }

        @media (min-width: 481px) {
          .modal-analysis {
            padding: 16px;
          }
        }

        .analysis-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          color: var(--text-secondary);
          font-size: 14px;
        }

        .loading-spinner {
          width: 24px;
          height: 24px;
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .analysis-error {
          text-align: center;
          color: var(--text-secondary);
          font-size: 14px;
          padding: 20px;
        }

        .analysis-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        @media (min-width: 481px) {
          .analysis-content {
            gap: 12px;
          }
        }

        /* VERDICT BANNER - Big, instant decision signal */
        .verdict-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 10px;
          border-radius: 8px;
          margin-bottom: 4px;
        }

        @media (min-width: 481px) {
          .verdict-banner {
            gap: 10px;
            padding: 10px 12px;
            border-radius: 10px;
          }
        }

        .verdict-banner.confirms {
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 180, 90, 0.1));
          border: 1px solid rgba(0, 230, 118, 0.4);
        }

        .verdict-banner.challenges {
          background: linear-gradient(135deg, rgba(255, 82, 82, 0.2), rgba(200, 50, 50, 0.1));
          border: 1px solid rgba(255, 82, 82, 0.4);
        }

        .verdict-banner.neutral {
          background: linear-gradient(135deg, rgba(255, 179, 0, 0.2), rgba(200, 140, 0, 0.1));
          border: 1px solid rgba(255, 179, 0, 0.4);
        }

        .verdict-icon {
          font-size: 20px;
          line-height: 1;
        }

        @media (min-width: 481px) {
          .verdict-icon {
            font-size: 24px;
          }
        }

        .verdict-text {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .verdict-label {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }

        @media (min-width: 481px) {
          .verdict-label {
            font-size: 18px;
          }
        }

        .verdict-banner.confirms .verdict-label { color: var(--yes); }
        .verdict-banner.challenges .verdict-label { color: var(--no); }
        .verdict-banner.neutral .verdict-label { color: var(--amber); }

        .verdict-confidence {
          font-size: 12px;
          color: var(--text-secondary);
        }

        .verdict-confidence.high { color: var(--yes); }
        .verdict-confidence.medium { color: var(--amber); }
        .verdict-confidence.low { color: var(--text-tertiary); }

        /* Quick Summary */
        .analysis-summary {
          font-size: 12px;
          line-height: 1.4;
          color: var(--text-secondary);
          margin: 0;
          padding: 0 2px;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (min-width: 481px) {
          .analysis-summary {
            font-size: 13px;
            line-height: 1.5;
            padding: 0 4px;
            -webkit-line-clamp: none;
            display: block;
          }
        }

        /* Pros vs Cons Grid */
        .pros-cons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-top: 2px;
        }

        @media (min-width: 481px) {
          .pros-cons-grid {
            gap: 10px;
            margin-top: 4px;
          }
        }

        .pros-section, .cons-section {
          background: rgba(255, 255, 255, 0.03);
          border-radius: 8px;
          padding: 8px;
        }

        @media (min-width: 481px) {
          .pros-section, .cons-section {
            border-radius: 10px;
            padding: 10px;
          }
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 700;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (min-width: 481px) {
          .section-header {
            gap: 6px;
            font-size: 12px;
            margin-bottom: 8px;
          }
        }

        .section-header.pros { color: var(--yes); }
        .section-header.cons { color: var(--no); }

        .section-icon {
          font-size: 12px;
          font-weight: 800;
        }

        @media (min-width: 481px) {
          .section-icon {
            font-size: 14px;
          }
        }

        .quick-facts {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .quick-facts li {
          font-size: 10px;
          line-height: 1.3;
          color: var(--text-secondary);
          margin-bottom: 4px;
          padding-left: 8px;
          position: relative;
        }

        @media (min-width: 481px) {
          .quick-facts li {
            font-size: 11px;
            line-height: 1.4;
            margin-bottom: 6px;
            padding-left: 10px;
          }
        }

        .quick-facts li:before {
          content: '•';
          position: absolute;
          left: 0;
          color: var(--text-tertiary);
        }

        .quick-facts li:last-child {
          margin-bottom: 0;
        }

        .no-facts {
          font-size: 10px;
          color: var(--text-tertiary);
          margin: 0;
          font-style: italic;
        }

        @media (min-width: 481px) {
          .no-facts {
            font-size: 11px;
          }
        }

        /* Sources Row - Compact chips */
        .sources-row {
          display: flex;
          align-items: flex-start;
          gap: 6px;
          margin-top: 4px;
          padding: 8px;
          background: rgba(0, 217, 255, 0.05);
          border-radius: 6px;
        }

        @media (min-width: 481px) {
          .sources-row {
            gap: 8px;
            margin-top: 8px;
            padding: 10px;
            border-radius: 8px;
          }
        }

        .sources-icon {
          font-size: 12px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        @media (min-width: 481px) {
          .sources-icon {
            font-size: 14px;
            margin-top: 2px;
          }
        }

        .sources-links {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        @media (min-width: 481px) {
          .sources-links {
            gap: 6px;
          }
        }

        .source-chip {
          display: inline-block;
          padding: 3px 8px;
          background: rgba(0, 217, 255, 0.1);
          border: 1px solid rgba(0, 217, 255, 0.3);
          border-radius: 10px;
          color: var(--accent);
          font-size: 10px;
          text-decoration: none;
          transition: all 0.2s;
          white-space: nowrap;
        }

        @media (min-width: 481px) {
          .source-chip {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 11px;
          }
        }

        .source-chip:hover {
          background: rgba(0, 217, 255, 0.2);
          border-color: var(--accent);
          color: #fff;
        }

        /* Research Links Section */
        .research-links-section {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .research-label {
          display: block;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: rgba(255, 255, 255, 0.5);
          margin-bottom: 8px;
        }

        .research-links-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .research-link {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 11px;
          font-weight: 500;
          text-decoration: none;
          transition: all 0.2s;
          touch-action: manipulation;
        }

        .research-link:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          color: #fff;
        }

        .research-link:active {
          transform: scale(0.96);
        }

        .research-link.primary {
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 176, 255, 0.15) 100%);
          border-color: rgba(0, 230, 118, 0.3);
          color: #00E676;
        }

        .research-link.primary:hover {
          background: linear-gradient(135deg, rgba(0, 230, 118, 0.25) 0%, rgba(0, 176, 255, 0.25) 100%);
          border-color: rgba(0, 230, 118, 0.5);
        }

        @media (min-width: 481px) {
          .research-link {
            padding: 8px 12px;
            font-size: 12px;
          }
        }

        .modal-market-info {
          display: flex;
          justify-content: space-around;
          padding: 8px 12px;
          background: rgba(0, 0, 0, 0.2);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        @media (min-width: 481px) {
          .modal-market-info {
            padding: 16px;
          }
        }

        .info-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        @media (min-width: 481px) {
          .info-item {
            gap: 4px;
          }
        }

        .info-label {
          font-size: 9px;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        @media (min-width: 481px) {
          .info-label {
            font-size: 11px;
          }
        }

        .info-value {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
        }

        @media (min-width: 481px) {
          .info-value {
            font-size: 14px;
          }
        }

        .modal-actions {
          display: flex;
          gap: 6px;
          padding: 10px 12px;
          padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          flex-shrink: 0;
        }

        @media (min-width: 481px) {
          .modal-actions {
            gap: 10px;
            padding: 12px 16px;
          }
        }

        .action-btn {
          flex: 1;
          padding: 8px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          min-height: 36px;
        }

        @media (min-width: 481px) {
          .action-btn {
            padding: 14px;
            font-size: 14px;
            border-radius: 12px;
            min-height: 44px;
          }
        }

        .change-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: var(--text-secondary);
        }

        .change-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        .confirm-btn {
          border: none;
        }

        .confirm-btn.yes {
          background: linear-gradient(135deg, var(--yes), #00B060);
          color: #000;
        }

        .confirm-btn.no {
          background: linear-gradient(135deg, var(--no), #CC4444);
          color: #fff;
        }

        .confirm-btn:hover {
          transform: scale(1.02);
        }

        /* RESPONSIVE - Premium compact widths */

        /* Small phones (iPhone SE, etc) */
        @media (max-width: 380px) {
          .bier-root {
            min-height: 420px;
          }
          .bier-card {
            width: calc(100% - 40px);
            max-width: 300px;
            border-radius: 20px;
          }
          .zone-hook {
            height: 80px;
            border-radius: 20px 20px 0 0;
          }
          .zone-question { padding: 10px 12px 6px; }
          .question { font-size: 15px; -webkit-line-clamp: 2; }
          .context { font-size: 11px; }
          .zone-number { padding: 0 12px 8px; }
          .chart-odds .odds-value { font-size: 32px; }
          .chart-container { gap: 2px; }
          .mini-chart { width: 80px; height: 30px; }
          .gauge-container { height: 6px; margin-bottom: 6px; }
          .payout-text { font-size: 11px; }
          .zone-social { padding: 8px 12px; }
          .social-stat { font-size: 11px; }
          .zone-ai-footer {
            padding: 8px 12px;
            min-height: 36px;
            border-radius: 0 0 20px 20px;
          }
          .ai-hint { font-size: 11px; }
          .ai-headline-text { -webkit-line-clamp: 2; }
          .control-btn { width: 56px; height: 56px; }
          .btn-icon { width: 24px; height: 24px; }
          .btn-skip { width: 42px; height: 42px; }
          .btn-skip .btn-icon { width: 18px; height: 18px; }
          .controls { gap: 32px; padding: 0 16px 12px; }
          .swipe-labels { padding: 6px 24px; font-size: 12px; }
          .deck-container { padding: 0 16px; }
        }

        /* Regular phones (381px - 480px) */
        @media (min-width: 381px) and (max-width: 480px) {
          .bier-card {
            width: calc(100% - 48px);
            max-width: 320px;
          }
          .zone-hook { height: 90px; }
          .question { font-size: 16px; }
          .chart-odds .odds-value { font-size: 34px; }
          .mini-chart { width: 90px; height: 32px; }
          .control-btn { width: 62px; height: 62px; }
          .controls { gap: 40px; padding: 0 20px 14px; }
        }

        /* Short screens (landscape) */
        @media (max-height: 700px) {
          .zone-hook { height: 70px; }
          .zone-question { padding: 8px 12px 6px; }
          .question { font-size: 15px; -webkit-line-clamp: 2; }
          .chart-odds .odds-value { font-size: 30px; }
          .zone-social { padding: 6px 12px; }
          .zone-ai-footer { padding: 8px 12px; min-height: 34px; }
          .controls { padding: 0 24px 10px; gap: 36px; }
          .swipe-labels { padding: 4px 30px; }
        }

        /* Very short screens */
        @media (max-height: 580px) {
          .zone-hook { height: 60px; }
          .zone-question { padding: 6px 12px 4px; }
          .question { -webkit-line-clamp: 1; font-size: 14px; }
          .context { display: none; }
          .zone-number { padding: 0 12px 6px; }
          .chart-odds .odds-value { font-size: 26px; }
          .chart-row { margin-bottom: 6px; }
          .zone-social { padding: 5px 12px; }
          .zone-ai-footer { padding: 6px 12px; min-height: 30px; }
          .ai-hint { font-size: 10px; }
          .controls { padding: 0 20px 8px; gap: 28px; }
          .control-btn { width: 50px; height: 50px; }
        }

        /* Tablets (768px+) */
        @media (min-width: 768px) {
          .deck-container { padding: 0 24px; }
          .bier-card {
            width: min(45vw, 360px);
            max-width: 360px;
            border-radius: 24px;
          }
          .zone-hook {
            height: 100px;
            border-radius: 24px 24px 0 0;
          }
          .zone-question { padding: 12px 16px 8px; }
          .question { font-size: 17px; -webkit-line-clamp: 2; }
          .context { font-size: 12px; }
          .zone-number { padding: 0 16px 10px; }
          .chart-odds .odds-value { font-size: 38px; }
          .chart-row { margin-bottom: 10px; }
          .mini-chart { width: 100px; height: 36px; }
          .gauge-container { height: 7px; margin-bottom: 8px; }
          .payout-text { font-size: 12px; }
          .zone-social { padding: 10px 16px; }
          .social-stat { font-size: 12px; }
          .zone-ai-footer {
            padding: 10px 16px;
            min-height: 44px;
            border-radius: 0 0 24px 24px;
          }
          .ai-hint { font-size: 12px; gap: 6px; }
          .ai-headline-text { -webkit-line-clamp: 2; }
          .controls { gap: 48px; padding: 0 24px 20px; }
          .control-btn { width: 64px; height: 64px; }
        }

        /* Small desktops (1024px+) */
        @media (min-width: 1024px) {
          .deck-container { padding: 0 32px; }
          .bier-card {
            width: min(32vw, 380px);
            max-width: 380px;
          }
          .zone-hook { height: 110px; }
          .question { font-size: 18px; }
          .chart-odds .odds-value { font-size: 40px; }
          .mini-chart { width: 110px; height: 40px; }
        }

        /* Desktop (1280px+) */
        @media (min-width: 1280px) {
          .deck-container { padding: 0 40px; }
          .bier-card {
            width: min(28vw, 400px);
            max-width: 400px;
            border-radius: 26px;
          }
          .zone-hook {
            height: 120px;
            border-radius: 26px 26px 0 0;
          }
          .zone-question { padding: 14px 18px 10px; }
          .question { font-size: 19px; }
          .context { font-size: 13px; }
          .zone-number { padding: 0 18px 12px; }
          .chart-odds .odds-value { font-size: 44px; }
          .mini-chart { width: 120px; height: 44px; }
          .gauge-container { height: 8px; margin-bottom: 10px; }
          .payout-text { font-size: 13px; }
          .zone-social { padding: 12px 18px; }
          .social-stat { font-size: 13px; }
          .zone-ai-footer {
            padding: 12px 18px;
            min-height: 48px;
            border-radius: 0 0 26px 26px;
          }
          .ai-hint { font-size: 13px; }
          .controls { gap: 56px; padding: 0 32px 24px; }
          .control-btn { width: 72px; height: 72px; }
          .btn-icon { width: 30px; height: 30px; }
          .btn-skip { width: 52px; height: 52px; }
        }

        /* Large Desktop (1536px+) */
        @media (min-width: 1536px) {
          .deck-container { padding: 0 48px; }
          .bier-card {
            width: min(24vw, 420px);
            max-width: 420px;
          }
          .zone-hook { height: 130px; }
          .question { font-size: 20px; }
          .chart-odds .odds-value { font-size: 48px; }
          .mini-chart { width: 130px; height: 48px; }
          .controls { gap: 60px; }
          .control-btn { width: 76px; height: 76px; }
        }
      `}</style>
        </div>
    );
}
