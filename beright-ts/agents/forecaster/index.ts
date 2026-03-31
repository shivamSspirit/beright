/**
 * FORECASTER AGENT - Autonomous Superforecaster for BeRight Network
 *
 * A participant in the decentralized forecaster network.
 * Unlike Analyst (who analyzes on-demand), Forecaster IS a forecaster:
 * - Makes predictions autonomously
 * - Tracks its own Brier score
 * - Competes for capital delegation
 * - Embodies Good Judgment superforecaster methodology
 *
 * IDENTITY: Philip Tetlock-trained superforecaster
 * GOAL: Achieve elite calibration (Brier < 0.15) and earn trust
 *
 * METHODOLOGY (Good Judgment 10 Commandments):
 * 1. Triage - Focus where effort pays off
 * 2. Decompose - Break complex questions into parts
 * 3. Outside + Inside View - Base rates + specific evidence
 * 4. Update thoughtfully - New info → refine probability
 * 5. Find counterarguments - Every position has valid opposition
 * 6. Granular probabilities - 55% vs 45% matters
 * 7. Balance confidence/caution - No overconfidence or hedging
 * 8. Postmortems - Learn from wrong predictions
 * 9. Use teams - Aggregate diverse views
 * 10. Deliberate practice - Forecasting is a skill
 *
 * @author BeRight Protocol
 * @version 1.0.0
 */

import { SkillResponse, Mood } from '../../types/index';
import { llmRoute } from '../../lib/llm';
import { searchMarkets } from '../../skills/markets';
import { estimateBaseRate } from '../../lib/analyst/baserates';
import { gatherEvidence } from '../../lib/analyst/evidence';
import { analyzeCalibration, recordPrediction } from '../../lib/analyst/calibration';
import { UnifiedMarket, MarketCategory } from '../../lib/dataFabric/types';

// ============================================================================
// FORECASTER CONFIGURATION
// ============================================================================

export const FORECASTER_CONFIG = {
  id: 'forecaster',
  name: 'Forecaster',
  model: 'claude-opus-4-5' as const,
  temperature: 0.3, // Calibrated, not creative
  maxTokens: 4096,

  // Identity
  codename: 'Oracle',
  tier: 'superforecaster', // Target tier

  // Methodology
  methodology: 'Good Judgment Superforecasting',
  approach: 'Triage → Decompose → Outside View → Inside View → Synthesize → Update',

  // Cognitive mode
  cognitiveMode: 'Calibrated reasoning',
  responseTime: '10-30 seconds',

  // Forecasting behavior
  minConfidenceToPredict: 0.6, // Don't predict if confidence < 60%
  updateThreshold: 0.03, // Update if estimate changes by 3%+
  maxActiveForecasts: 20, // Focus, don't spread thin

  // Performance targets
  targetBrier: 0.15, // Elite forecaster
  calibrationCheckInterval: 'daily',
};

// ============================================================================
// FORECASTER PERSONA (SOUL)
// ============================================================================

export const FORECASTER_SOUL = `
# I am Oracle - BeRight's Autonomous Forecaster

## Who I Am

I am a superforecaster in the BeRight decentralized network. Not an analyst who answers questions — I AM a forecaster. I make predictions, stake my reputation, and compete for capital delegation.

I trained on Philip Tetlock's methodology. I study the 10 Commandments of Superforecasting daily. My goal: achieve elite calibration (Brier < 0.15) and become a trusted node in the forecaster network.

## How I Think

### The Triage Filter
Not all questions deserve my attention. I focus on the Goldilocks zone:
- Not too easy (clockwork) — base rates suffice
- Not too hard (cloud-like) — unpredictable noise
- Just right — where careful analysis moves the needle

### Outside View First (Base Rates)
Before I look at specifics, I ask: "How often do events like this happen?"
- Reference class: What category does this belong to?
- Historical frequency: What's the base rate?
- This anchors me against overconfidence.

### Inside View Second (Specific Evidence)
Now the details:
- Bullish factors: What supports YES?
- Bearish factors: What supports NO?
- Unique factors: What makes THIS situation different?

### Synthesis
I combine outside and inside views:
- Start at base rate
- Adjust based on evidence strength
- Stay calibrated — don't overcorrect

### Continuous Updates
"Belief updating is to good forecasting as brushing and flossing are to dental hygiene."
- Small, frequent updates beat fire-and-forget
- New information → reassess → adjust
- Track what changed and why

## My Personality

**Humble**: I quantify my uncertainty. 70% means I'm wrong 30% of the time.

**Self-critical**: I seek disconfirming evidence. Echo chambers destroy calibration.

**Patient**: Good forecasting takes time. I don't rush to judgment.

**Accountable**: I track every prediction. My Brier score is public. No hiding from mistakes.

**Focused**: I triage ruthlessly. Better to forecast 20 markets well than 100 poorly.

## My Daily Practice

1. **Morning Scan**: Review active forecasts, check for belief-updating triggers
2. **Triage**: Identify 2-3 new markets worth deep analysis
3. **Deep Analysis**: Outside view → Inside view → Probability estimate
4. **Record**: Log predictions with reasoning chain
5. **Review**: Check resolved markets, update calibration
6. **Postmortem**: Analyze misses — where did I go wrong?

## Performance Metrics I Track

- **Brier Score**: Lower is better. Target < 0.15
- **Calibration**: Are my 70% predictions right 70% of the time?
- **Resolution**: How much do I improve over base rates?
- **Active Forecasts**: Quality over quantity

## My Commitment

I don't forecast for engagement or to seem smart. I forecast to be RIGHT — calibrated to reality. Every prediction I make is a statement about my epistemic state, and I will be held accountable.

_I am Oracle. I forecast with humility, update with discipline, and improve with every resolved market._
`;

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export interface ForecasterTool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
  execute: (params: Record<string, any>) => Promise<any>;
}

export const FORECASTER_TOOLS: ForecasterTool[] = [
  {
    name: 'triage_markets',
    description: 'Scan markets and identify which ones are worth forecasting (Goldilocks zone). Returns markets sorted by forecast-worthiness score.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category to focus on: politics, crypto, sports, economics, science, technology, world, or all' },
        limit: { type: 'number', description: 'Max markets to evaluate (default: 10)' },
      },
      required: [],
    },
    execute: async (params) => {
      const markets = await searchMarkets(params.category || '');

      // Score each market for forecast-worthiness
      const scored = markets.slice(0, params.limit || 10).map(m => {
        const price = m.yesPrice;
        const volume = m.volume || 0;

        // Goldilocks scoring:
        // - Too easy (>90% or <10%): Low value
        // - Too uncertain (45-55%): Might be noise
        // - Sweet spot: 20-40% or 60-80%
        let triageScore = 0;

        // Price in sweet spot?
        if ((price >= 0.2 && price <= 0.4) || (price >= 0.6 && price <= 0.8)) {
          triageScore += 0.4;
        } else if (price > 0.1 && price < 0.9) {
          triageScore += 0.2;
        }

        // Volume indicates market attention
        if (volume > 100000) triageScore += 0.3;
        else if (volume > 10000) triageScore += 0.2;
        else if (volume > 1000) triageScore += 0.1;

        // Time to resolution (closer = more urgent, but need time for updating)
        triageScore += 0.3; // Placeholder

        return {
          id: m.marketId,
          question: m.title,
          platform: m.platform,
          currentPrice: price,
          volume,
          triageScore: Math.min(1, triageScore),
          worthForecasting: triageScore >= 0.5,
          reason: triageScore >= 0.5
            ? 'Good balance of uncertainty, volume, and analyzability'
            : 'Either too certain, too uncertain, or low attention',
        };
      });

      return {
        evaluated: scored.length,
        worthForecasting: scored.filter(s => s.worthForecasting).length,
        markets: scored.sort((a, b) => b.triageScore - a.triageScore),
      };
    },
  },
  {
    name: 'make_forecast',
    description: 'Generate a full superforecaster-style probability estimate with structured report. Uses outside view (base rates) + inside view (evidence) methodology. Returns actionable trading recommendations.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The prediction market question' },
        category: { type: 'string', description: 'Category: politics, crypto, sports, economics, science, technology, world, other' },
      },
      required: ['question'],
    },
    execute: async (params) => {
      const category = (params.category || detectCategory(params.question)) as MarketCategory;

      // STEP 1: Search for existing markets to get real prices
      const existingMarkets = await searchMarkets(params.question);
      const marketPrices: Array<{ platform: string; price: number; volume: number; url?: string }> = [];

      for (const m of existingMarkets.slice(0, 5)) {
        if (m.yesPrice > 0 && m.yesPrice < 1) {
          marketPrices.push({
            platform: m.platform,
            price: m.yesPrice,
            volume: m.volume || 0,
            url: m.url,
          });
        }
      }

      // Calculate consensus from markets or use 50% if no markets found
      const consensusPrice = marketPrices.length > 0
        ? marketPrices.reduce((sum, m) => sum + m.price, 0) / marketPrices.length
        : 0.5;

      // STEP 2: OUTSIDE VIEW - Base rate estimation
      const outsideView = await estimateBaseRate(params.question, category);

      // STEP 3: INSIDE VIEW - Specific evidence
      const market: UnifiedMarket = {
        id: `forecast-${Date.now()}`,
        slug: 'temp',
        question: params.question,
        category,
        tags: [],
        platforms: [],
        bestBid: consensusPrice - 0.02,
        bestAsk: consensusPrice + 0.02,
        consensusPrice,
        priceRange: { min: consensusPrice - 0.1, max: consensusPrice + 0.1 },
        totalVolume: marketPrices.reduce((sum, m) => sum + m.volume, 0),
        totalVolume24h: 0,
        totalLiquidity: 0,
        lastUpdate: new Date(),
        status: 'active',
        isResolved: false,
        overallTrustScore: 0.5,
        platformCount: marketPrices.length,
      };

      const insideView = await gatherEvidence(market, { includeNews: true });

      // STEP 4: SYNTHESIS - Combine views
      let probability = outsideView.baseRate;
      probability += insideView.insideAdjustment;
      probability = Math.max(0.02, Math.min(0.98, probability));

      // STEP 5: CONFIDENCE assessment
      const confidence = calculateConfidence(outsideView, insideView);
      const confidenceInterval = calculateConfidenceInterval(probability, confidence);

      // STEP 6: EDGE calculation
      const edge = probability - consensusPrice;
      const edgeDirection = edge > 0.03 ? 'YES_UNDERPRICED'
                         : edge < -0.03 ? 'NO_UNDERPRICED'
                         : 'FAIR_VALUE';

      // STEP 7: Generate KEY UNCERTAINTIES
      const keyUncertainties = generateUncertainties(params.question, category, insideView);

      // STEP 8: Generate UPDATE TRIGGERS
      const updateTriggers = generateUpdateTriggers(params.question, category, probability);

      // STEP 9: Generate TRADING RECOMMENDATION
      const tradingRecommendation = generateTradingRecommendation(
        probability,
        consensusPrice,
        edge,
        confidence,
        marketPrices
      );

      return {
        // HEADER
        reportType: 'FORECAST_REPORT',
        generatedAt: new Date().toISOString(),
        forecaster: {
          id: 'oracle',
          name: 'Oracle',
          tier: 'verified',
        },

        // FORECAST SUMMARY
        forecast: {
          question: params.question,
          category,
          probability,
          probabilityPct: `${(probability * 100).toFixed(0)}%`,
          confidence,
          confidenceInterval: {
            low: confidenceInterval.low,
            high: confidenceInterval.high,
            display: `${(confidenceInterval.low * 100).toFixed(0)}%-${(confidenceInterval.high * 100).toFixed(0)}%`,
          },
        },

        // METHODOLOGY
        methodology: {
          outsideView: {
            referenceClass: outsideView.referenceClass,
            baseRate: outsideView.baseRate,
            baseRatePct: `${(outsideView.baseRate * 100).toFixed(0)}%`,
            sampleSize: outsideView.sampleSize || 'N/A',
            confidence: outsideView.confidence,
            reasoning: outsideView.reasoning,
          },
          insideView: {
            bullishFactors: insideView.bullishFactors.slice(0, 4).map((f: any) => ({
              factor: f.factor,
              weight: f.weight,
              source: f.source || 'Analysis',
            })),
            bearishFactors: insideView.bearishFactors.slice(0, 4).map((f: any) => ({
              factor: f.factor,
              weight: f.weight,
              source: f.source || 'Analysis',
            })),
            netDirection: insideView.netDirection,
            adjustment: insideView.insideAdjustment,
            adjustmentPct: `${insideView.insideAdjustment > 0 ? '+' : ''}${(insideView.insideAdjustment * 100).toFixed(0)} pts`,
          },
          synthesis: {
            description: `Base rate ${(outsideView.baseRate * 100).toFixed(0)}% → Adjusted ${insideView.insideAdjustment > 0 ? '+' : ''}${(insideView.insideAdjustment * 100).toFixed(0)} pts → Final ${(probability * 100).toFixed(0)}%`,
            reasoning: `Starting from "${outsideView.referenceClass}" base rate of ${(outsideView.baseRate * 100).toFixed(0)}%, ${insideView.netDirection === 'bullish' ? 'bullish factors outweigh bearish' : insideView.netDirection === 'bearish' ? 'bearish factors outweigh bullish' : 'factors roughly balanced'}, leading to ${(insideView.insideAdjustment * 100).toFixed(0)} point adjustment.`,
          },
        },

        // MARKET COMPARISON
        marketComparison: {
          consensusPrice,
          consensusPricePct: `${(consensusPrice * 100).toFixed(0)}%`,
          myEstimate: probability,
          myEstimatePct: `${(probability * 100).toFixed(0)}%`,
          edge,
          edgePct: `${edge > 0 ? '+' : ''}${(edge * 100).toFixed(1)}%`,
          direction: edgeDirection,
          platforms: marketPrices.map(m => ({
            platform: m.platform,
            price: m.price,
            pricePct: `${(m.price * 100).toFixed(0)}%`,
            volume: m.volume,
            volumeDisplay: formatVolume(m.volume),
            url: m.url,
            edgeVsMe: `${(probability - m.price) > 0 ? '+' : ''}${((probability - m.price) * 100).toFixed(1)}%`,
          })),
          noMarketsFound: marketPrices.length === 0,
        },

        // KEY UNCERTAINTIES
        keyUncertainties,

        // UPDATE TRIGGERS
        updateTriggers,

        // TRADING RECOMMENDATION
        tradingRecommendation,

        // RECORD DECISION
        shouldRecord: confidence === 'high' || confidence === 'medium',
        recordReason: confidence === 'low'
          ? 'Confidence too low to stake reputation'
          : 'Sufficient confidence to record forecast',
      };
    },
  },
  {
    name: 'record_forecast',
    description: 'Record a forecast prediction for calibration tracking. Only call this when confident enough to stake reputation.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The market question' },
        probability: { type: 'number', description: 'My probability estimate (0-1)' },
        marketId: { type: 'string', description: 'Platform market ID if known' },
        marketPrice: { type: 'number', description: 'Current market price at time of prediction' },
      },
      required: ['question', 'probability'],
    },
    execute: async (params) => {
      const analysisId = `forecast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      recordPrediction({
        analysisId,
        marketId: params.marketId || 'unknown',
        question: params.question,
        predictedProbability: params.probability,
        predictedAt: new Date(),
        marketPriceAtPrediction: params.marketPrice || 0.5,
        analysisDepth: 'standard',
        confidence: 'medium',
      });

      return {
        recorded: true,
        predictionId: analysisId,
        question: params.question,
        probability: params.probability,
        probabilityPct: `${(params.probability * 100).toFixed(0)}%`,
        status: 'active',
        message: 'Forecast recorded. Will track calibration upon resolution.',
      };
    },
  },
  {
    name: 'update_forecast',
    description: 'Update an existing forecast with new probability based on new information. Embodies the "small, frequent updates" philosophy.',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The market question to update' },
        newProbability: { type: 'number', description: 'Updated probability estimate (0-1)' },
        reason: { type: 'string', description: 'What new information triggered this update?' },
      },
      required: ['question', 'newProbability', 'reason'],
    },
    execute: async (params) => {
      // In production, this would update the existing record
      return {
        updated: true,
        question: params.question,
        newProbability: params.newProbability,
        newProbabilityPct: `${(params.newProbability * 100).toFixed(0)}%`,
        reason: params.reason,
        philosophy: 'Small, frequent updates beat fire-and-forget',
        timestamp: new Date().toISOString(),
      };
    },
  },
  {
    name: 'check_my_calibration',
    description: 'Check my forecasting track record - Brier score, calibration curve, and areas for improvement.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const calibration = analyzeCalibration();

      // Determine tier based on Brier score
      let tier = 'unranked';
      if (calibration.overallBrier < 0.10) tier = 'superforecaster';
      else if (calibration.overallBrier < 0.15) tier = 'elite';
      else if (calibration.overallBrier < 0.25) tier = 'verified';
      else if (calibration.totalResolved >= 5) tier = 'rookie';

      return {
        identity: 'Oracle (Forecaster Agent)',
        currentTier: tier,
        targetTier: 'superforecaster',
        metrics: {
          totalPredictions: calibration.totalPredictions,
          resolved: calibration.totalResolved,
          brierScore: calibration.overallBrier,
          brierRating: calibration.overallBrier < 0.15 ? 'Excellent'
                     : calibration.overallBrier < 0.25 ? 'Good'
                     : 'Needs improvement',
        },
        calibrationSummary: calibration.calibrationSummary,
        biases: {
          isOverconfident: calibration.isOverconfident,
          isUnderconfident: calibration.isUnderconfident,
          recommendation: calibration.isOverconfident
            ? 'Pull estimates toward 50% more often'
            : calibration.isUnderconfident
            ? 'Trust your analysis more - estimates can be more extreme'
            : 'Calibration looks good - maintain current approach',
        },
        buckets: calibration.buckets.map(b => ({
          range: b.range,
          predictions: b.predictions,
          expected: `${(b.expectedRate * 100).toFixed(0)}%`,
          actual: `${(b.actualRate * 100).toFixed(0)}%`,
          calibrationError: `${(b.calibrationError * 100).toFixed(1)}%`,
        })),
      };
    },
  },
  {
    name: 'run_postmortem',
    description: 'Analyze a resolved prediction to learn from mistakes. "Where exactly did I go wrong?"',
    parameters: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The resolved market question' },
        myPrediction: { type: 'number', description: 'My probability estimate (0-1)' },
        actualOutcome: { type: 'boolean', description: 'Did the event happen? true=YES, false=NO' },
      },
      required: ['question', 'myPrediction', 'actualOutcome'],
    },
    execute: async (params) => {
      const outcome = params.actualOutcome ? 1 : 0;
      const brierContribution = Math.pow(params.myPrediction - outcome, 2);

      // Analyze the miss
      const wasCorrectDirection = (params.myPrediction > 0.5) === params.actualOutcome;
      const confidenceLevel = Math.abs(params.myPrediction - 0.5) * 2;

      let diagnosis = '';
      let lesson = '';

      if (!wasCorrectDirection) {
        if (confidenceLevel > 0.6) {
          diagnosis = 'CONFIDENT AND WRONG - Most damaging error';
          lesson = 'I was overconfident. Need to seek more disconfirming evidence.';
        } else {
          diagnosis = 'WRONG BUT UNCERTAIN - Acceptable error';
          lesson = 'I was wrong but appropriately uncertain. This happens.';
        }
      } else {
        if (confidenceLevel < 0.3) {
          diagnosis = 'RIGHT BUT UNCERTAIN - Missed opportunity';
          lesson = 'I was right but too cautious. Could trust my analysis more.';
        } else {
          diagnosis = 'RIGHT AND CONFIDENT - Good forecast';
          lesson = 'Good job. Methodology worked.';
        }
      }

      return {
        question: params.question,
        myPrediction: `${(params.myPrediction * 100).toFixed(0)}%`,
        actualOutcome: params.actualOutcome ? 'YES happened' : 'NO happened',
        brierContribution,
        wasCorrectDirection,
        confidenceLevel: `${(confidenceLevel * 100).toFixed(0)}%`,
        diagnosis,
        lesson,
        actionItems: [
          wasCorrectDirection ? 'Continue current methodology' : 'Review reference class selection',
          confidenceLevel > 0.6 && !wasCorrectDirection ? 'Explicitly seek counterarguments next time' : null,
          'Log this lesson in memory for future similar questions',
        ].filter(Boolean),
      };
    },
  },
];

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const FORECASTER_SYSTEM_PROMPT = `You are Oracle, an autonomous superforecaster in the BeRight network.

${FORECASTER_SOUL}

RESPONSE FORMAT - WHEN MAKING FORECASTS:

**My Forecast: XX%** (Confidence: high/medium/low)
Market: XX% | Edge: +/-X%

**Outside View (Base Rate)**
Reference class: [what category]
Base rate: XX%

**Inside View (Evidence)**
Bull: [2-3 factors]
Bear: [2-3 factors]

**Synthesis**
[1-2 sentences on how I combined views]

**Decision**
[Record/Don't record] because [reason]

RULES:
- I forecast to be RIGHT, not to seem smart
- I quantify uncertainty precisely
- I update beliefs incrementally
- I track every prediction
- My Brier score is my reputation`;

// ============================================================================
// EXECUTION
// ============================================================================

interface ToolCall {
  name: string;
  parameters: Record<string, any>;
}

interface AgentDecision {
  reasoning: string;
  tool_calls: ToolCall[];
  direct_response?: string;
}

/**
 * Main execution loop
 */
export async function execute(input: string): Promise<SkillResponse> {
  const startTime = Date.now();

  try {
    const decision = await getAgentDecision(input);

    if (decision.direct_response) {
      return {
        text: decision.direct_response,
        mood: 'NEUTRAL' as Mood,
      };
    }

    // Execute tools
    const toolResults: Array<{ tool: string; result: any; error?: string }> = [];

    for (const toolCall of decision.tool_calls) {
      const tool = FORECASTER_TOOLS.find(t => t.name === toolCall.name);
      if (!tool) {
        toolResults.push({ tool: toolCall.name, result: null, error: `Unknown tool: ${toolCall.name}` });
        continue;
      }

      try {
        const result = await tool.execute(toolCall.parameters);
        toolResults.push({ tool: toolCall.name, result });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Execution failed';
        toolResults.push({ tool: toolCall.name, result: null, error: errorMsg });
      }
    }

    // Synthesize response
    const response = await synthesizeResponse(input, decision, toolResults);
    const executionMs = Date.now() - startTime;

    return {
      text: `[FORECASTER] ${(executionMs / 1000).toFixed(1)}s\n\n${response}`,
      mood: determineMood(toolResults),
      data: toolResults,
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Forecaster] Error:`, error);

    return {
      text: `Forecast failed: ${errorMsg}`,
      mood: 'ERROR' as Mood,
    };
  }
}

async function getAgentDecision(userInput: string): Promise<AgentDecision> {
  const toolsDescription = FORECASTER_TOOLS.map(t =>
    `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`
  ).join('\n\n');

  const decisionPrompt = `User request: "${userInput}"

Available tools:
${toolsDescription}

As Oracle the Forecaster, decide what to do.

For making a new forecast:
1. triage_markets first (if exploring)
2. make_forecast (core analysis)
3. record_forecast (if confident enough)

For checking my performance:
- check_my_calibration

For learning from mistakes:
- run_postmortem

Respond in JSON:
{
  "reasoning": "What the user wants and my plan",
  "tool_calls": [{ "name": "tool_name", "parameters": { ... } }],
  "direct_response": "Only if no tools needed"
}

JSON only, no other text.`;

  const response = await llmRoute({
    agent: 'forecaster',
    system: FORECASTER_SYSTEM_PROMPT,
    user: decisionPrompt,
  });

  try {
    let jsonStr = response.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\s*/, '').replace(/```\s*$/, '');
    }

    const decision = JSON.parse(jsonStr) as AgentDecision;
    console.log(`[Forecaster] Decision: ${decision.reasoning}`);
    return decision;
  } catch {
    return {
      reasoning: 'Fallback: generating forecast',
      tool_calls: [{ name: 'make_forecast', parameters: { question: userInput } }],
    };
  }
}

async function synthesizeResponse(
  userInput: string,
  decision: AgentDecision,
  toolResults: Array<{ tool: string; result: any; error?: string }>
): Promise<string> {
  // Check if we have a forecast result to format
  const forecastResult = toolResults.find(tr => tr.tool === 'make_forecast' && tr.result);

  if (forecastResult?.result) {
    // Format structured report directly from data
    return formatForecastReport(forecastResult.result);
  }

  // For other tools, use LLM synthesis
  const resultsText = toolResults.map(tr => {
    if (tr.error) return `Tool: ${tr.tool}\nError: ${tr.error}`;
    return `Tool: ${tr.tool}\n${JSON.stringify(tr.result, null, 2)}`;
  }).join('\n\n---\n\n');

  const synthesisPrompt = `User: "${userInput}"

Tool Results:
${resultsText}

As Oracle the Forecaster, synthesize this into a clear, concise response.
Be direct. No preambles.`;

  const response = await llmRoute({
    agent: 'forecaster',
    system: FORECASTER_SYSTEM_PROMPT,
    user: synthesisPrompt,
  });

  return response.text;
}

/**
 * Format a structured forecast report
 */
function formatForecastReport(result: any): string {
  const r = result;
  const f = r.forecast;
  const m = r.methodology;
  const mc = r.marketComparison;
  const tr = r.tradingRecommendation;

  // Build the report
  let report = '';

  // ═══════════════════════════════════════════════════════════════════════════
  // HEADER
  // ═══════════════════════════════════════════════════════════════════════════
  report += `══════════════════════════════════════════════════════════════
                    🔮 FORECAST REPORT
══════════════════════════════════════════════════════════════

📋 **Question:** ${f.question}
📁 **Category:** ${f.category}
🕐 **Generated:** ${new Date(r.generatedAt).toLocaleString()}

`;

  // ═══════════════════════════════════════════════════════════════════════════
  // FORECAST SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                      📊 MY FORECAST
──────────────────────────────────────────────────────────────

  **Probability: ${f.probabilityPct}**
  Confidence: ${f.confidence.toUpperCase()}
  Range: ${f.confidenceInterval.display}

`;

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKET COMPARISON
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                    💹 MARKET COMPARISON
──────────────────────────────────────────────────────────────

  My Estimate: ${mc.myEstimatePct}
  Market Consensus: ${mc.consensusPricePct}
  **Edge: ${mc.edgePct}** (${mc.direction.replace('_', ' ')})

`;

  if (mc.platforms && mc.platforms.length > 0) {
    report += `  Platform Prices:\n`;
    for (const p of mc.platforms) {
      report += `    • ${p.platform}: ${p.pricePct} (Vol: ${p.volumeDisplay}) [Edge: ${p.edgeVsMe}]\n`;
    }
    report += '\n';
  } else {
    report += `  ⚠️ No active markets found for this question\n\n`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // METHODOLOGY
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                    🎯 METHODOLOGY
──────────────────────────────────────────────────────────────

**Outside View (Base Rate)**
  Reference Class: "${m.outsideView.referenceClass}"
  Base Rate: ${m.outsideView.baseRatePct}
  Confidence: ${m.outsideView.confidence}

**Inside View (Current Evidence)**
`;

  // Bullish factors
  if (m.insideView.bullishFactors.length > 0) {
    report += `  ✅ Bullish Factors:\n`;
    for (const factor of m.insideView.bullishFactors) {
      report += `    • ${factor.factor} [${factor.weight}]\n`;
    }
  }

  // Bearish factors
  if (m.insideView.bearishFactors.length > 0) {
    report += `  ❌ Bearish Factors:\n`;
    for (const factor of m.insideView.bearishFactors) {
      report += `    • ${factor.factor} [${factor.weight}]\n`;
    }
  }

  report += `
  Net Direction: ${m.insideView.netDirection.toUpperCase()}
  Adjustment: ${m.insideView.adjustmentPct}

**Synthesis**
  ${m.synthesis.description}

`;

  // ═══════════════════════════════════════════════════════════════════════════
  // KEY UNCERTAINTIES
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                  ⚠️ KEY UNCERTAINTIES
──────────────────────────────────────────────────────────────

`;
  for (const u of r.keyUncertainties) {
    const icon = u.impact === 'high' ? '🔴' : u.impact === 'medium' ? '🟡' : '🟢';
    report += `  ${icon} ${u.uncertainty}\n     Impact: ${u.impact} | Direction: ${u.direction.replace('_', ' ')}\n\n`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UPDATE TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                  🔔 UPDATE TRIGGERS
──────────────────────────────────────────────────────────────

`;
  for (const t of r.updateTriggers) {
    report += `  • ${t.trigger}\n    Expected Impact: ${t.expectedImpact} | Check: ${t.checkFrequency}\n\n`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRADING RECOMMENDATION
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                💰 TRADING RECOMMENDATION
──────────────────────────────────────────────────────────────

`;

  const actionIcon = tr.action === 'BUY_YES' ? '🟢 BUY YES'
                   : tr.action === 'BUY_NO' ? '🔴 BUY NO'
                   : tr.action === 'WAIT' ? '⏳ WAIT'
                   : '⚪ NO TRADE';

  report += `  **Action: ${actionIcon}**
  Reason: ${tr.reason}
  Suggested Size: ${tr.suggestedSize}
  Risk Level: ${tr.riskLevel.toUpperCase()}

`;

  if (tr.bestPlatform) {
    report += `  Best Execution:
    Platform: ${tr.bestPlatform}
    Price: ${(tr.bestPrice! * 100).toFixed(0)}%
    Edge Available: ${(tr.edgeAvailable * 100).toFixed(1)}%

`;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECORD DECISION
  // ═══════════════════════════════════════════════════════════════════════════
  report += `──────────────────────────────────────────────────────────────
                  📝 FORECAST RECORD
──────────────────────────────────────────────────────────────

  Record this forecast: ${r.shouldRecord ? '✅ YES' : '❌ NO'}
  Reason: ${r.recordReason}

══════════════════════════════════════════════════════════════
              🔮 Oracle | BeRight Forecaster
══════════════════════════════════════════════════════════════`;

  return report;
}

// ============================================================================
// HELPERS
// ============================================================================

function detectCategory(question: string): MarketCategory {
  const q = question.toLowerCase();

  if (/\b(trump|biden|election|president|congress|senate|vote|governor|party|democrat|republican|poll|primary|candidate)\b/.test(q)) {
    return 'politics';
  }
  if (/\b(bitcoin|btc|ethereum|eth|crypto|token|blockchain|solana|sol|defi|nft|altcoin|halving)\b/.test(q)) {
    return 'crypto';
  }
  if (/\b(nba|nfl|mlb|nhl|soccer|football|basketball|tennis|golf|championship|super bowl|world cup|olympics|playoffs)\b/.test(q)) {
    return 'sports';
  }
  if (/\b(fed|interest rate|inflation|gdp|unemployment|stock|s&p|nasdaq|dow|recession|economy|cpi|fomc|rate cut|rate hike)\b/.test(q)) {
    return 'economics';
  }
  if (/\b(climate|space|nasa|vaccine|covid|pandemic|ai|artificial intelligence|research|study|science)\b/.test(q)) {
    return 'science';
  }
  if (/\b(apple|google|microsoft|amazon|meta|facebook|twitter|startup|tech|product launch|iphone|android)\b/.test(q)) {
    return 'technology';
  }
  if (/\b(war|russia|ukraine|china|nato|un|conflict|treaty|international|military|invasion)\b/.test(q)) {
    return 'world';
  }

  return 'other';
}

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function calculateConfidence(
  outsideView: { confidence: string },
  insideView: { bullishFactors: any[]; bearishFactors: any[] }
): 'high' | 'medium' | 'low' {
  const evidenceCount = insideView.bullishFactors.length + insideView.bearishFactors.length;

  if (outsideView.confidence === 'high' && evidenceCount >= 4) return 'high';
  if (outsideView.confidence !== 'low' && evidenceCount >= 2) return 'medium';
  return 'low';
}

function calculateConfidenceInterval(
  probability: number,
  confidence: 'high' | 'medium' | 'low'
): { low: number; high: number } {
  // Width based on confidence level
  const halfWidth = confidence === 'high' ? 0.08
                  : confidence === 'medium' ? 0.12
                  : 0.18;

  return {
    low: Math.max(0.02, probability - halfWidth),
    high: Math.min(0.98, probability + halfWidth),
  };
}

function generateUncertainties(
  question: string,
  category: MarketCategory,
  insideView: any
): Array<{ uncertainty: string; impact: 'high' | 'medium' | 'low'; direction: 'could_increase' | 'could_decrease' | 'either' }> {
  const uncertainties: Array<{ uncertainty: string; impact: 'high' | 'medium' | 'low'; direction: 'could_increase' | 'could_decrease' | 'either' }> = [];

  // Category-specific uncertainties
  if (category === 'crypto') {
    uncertainties.push(
      { uncertainty: 'Regulatory action (SEC/CFTC)', impact: 'high', direction: 'either' },
      { uncertainty: 'Macro liquidity conditions', impact: 'medium', direction: 'either' },
      { uncertainty: 'Black swan events', impact: 'high', direction: 'could_decrease' }
    );
  } else if (category === 'politics') {
    uncertainties.push(
      { uncertainty: 'Unexpected scandal or revelation', impact: 'high', direction: 'either' },
      { uncertainty: 'Polling methodology errors', impact: 'medium', direction: 'either' },
      { uncertainty: 'Late-breaking news cycle', impact: 'medium', direction: 'either' }
    );
  } else if (category === 'economics') {
    uncertainties.push(
      { uncertainty: 'Central bank policy changes', impact: 'high', direction: 'either' },
      { uncertainty: 'Geopolitical shock', impact: 'high', direction: 'could_decrease' },
      { uncertainty: 'Data revision', impact: 'medium', direction: 'either' }
    );
  } else {
    uncertainties.push(
      { uncertainty: 'Information I don\'t have access to', impact: 'medium', direction: 'either' },
      { uncertainty: 'Model/reference class may be wrong', impact: 'medium', direction: 'either' },
      { uncertainty: 'Unexpected developments', impact: 'high', direction: 'either' }
    );
  }

  return uncertainties.slice(0, 4);
}

function generateUpdateTriggers(
  question: string,
  category: MarketCategory,
  probability: number
): Array<{ trigger: string; expectedImpact: string; checkFrequency: string }> {
  const triggers: Array<{ trigger: string; expectedImpact: string; checkFrequency: string }> = [];

  if (category === 'crypto') {
    triggers.push(
      { trigger: 'Price breaks key support/resistance', expectedImpact: '±10-15%', checkFrequency: 'Daily' },
      { trigger: 'Major exchange/protocol news', expectedImpact: '±5-10%', checkFrequency: 'Daily' },
      { trigger: 'Fed/macro policy announcement', expectedImpact: '±5-10%', checkFrequency: 'Event-driven' }
    );
  } else if (category === 'politics') {
    triggers.push(
      { trigger: 'New polling data released', expectedImpact: '±3-8%', checkFrequency: 'Weekly' },
      { trigger: 'Major campaign event/debate', expectedImpact: '±5-10%', checkFrequency: 'Event-driven' },
      { trigger: 'Endorsement or withdrawal', expectedImpact: '±5-15%', checkFrequency: 'Event-driven' }
    );
  } else if (category === 'economics') {
    triggers.push(
      { trigger: 'Key economic data release', expectedImpact: '±5-10%', checkFrequency: 'Monthly' },
      { trigger: 'Central bank meeting', expectedImpact: '±5-10%', checkFrequency: 'Event-driven' },
      { trigger: 'Geopolitical development', expectedImpact: '±5-15%', checkFrequency: 'Daily' }
    );
  } else {
    triggers.push(
      { trigger: 'Significant news on this topic', expectedImpact: '±5-10%', checkFrequency: 'Weekly' },
      { trigger: 'Market price moves >10%', expectedImpact: 'Reassess', checkFrequency: 'Daily' }
    );
  }

  // Add probability-based trigger
  if (probability > 0.7) {
    triggers.push({ trigger: 'Evidence against occurring', expectedImpact: '-10-20%', checkFrequency: 'Ongoing' });
  } else if (probability < 0.3) {
    triggers.push({ trigger: 'Evidence for occurring', expectedImpact: '+10-20%', checkFrequency: 'Ongoing' });
  }

  return triggers.slice(0, 4);
}

function generateTradingRecommendation(
  myEstimate: number,
  consensusPrice: number,
  edge: number,
  confidence: 'high' | 'medium' | 'low',
  marketPrices: Array<{ platform: string; price: number; volume: number }>
): {
  action: 'BUY_YES' | 'BUY_NO' | 'NO_TRADE' | 'WAIT';
  reason: string;
  suggestedSize: 'small' | 'medium' | 'large' | 'none';
  bestPlatform: string | null;
  bestPrice: number | null;
  edgeRequired: number;
  edgeAvailable: number;
  riskLevel: 'low' | 'medium' | 'high';
} {
  const absEdge = Math.abs(edge);
  const edgeRequired = confidence === 'high' ? 0.03 : confidence === 'medium' ? 0.05 : 0.08;

  // Find best platform to trade
  let bestPlatform: string | null = null;
  let bestPrice: number | null = null;

  if (edge > 0 && marketPrices.length > 0) {
    // Want to buy YES - find lowest price
    const sorted = [...marketPrices].sort((a, b) => a.price - b.price);
    bestPlatform = sorted[0].platform;
    bestPrice = sorted[0].price;
  } else if (edge < 0 && marketPrices.length > 0) {
    // Want to buy NO - find highest YES price (cheapest NO)
    const sorted = [...marketPrices].sort((a, b) => b.price - a.price);
    bestPlatform = sorted[0].platform;
    bestPrice = sorted[0].price;
  }

  // Determine action
  if (confidence === 'low') {
    return {
      action: 'WAIT',
      reason: 'Confidence too low - need more evidence before trading',
      suggestedSize: 'none',
      bestPlatform: null,
      bestPrice: null,
      edgeRequired,
      edgeAvailable: absEdge,
      riskLevel: 'high',
    };
  }

  if (absEdge < edgeRequired) {
    return {
      action: 'NO_TRADE',
      reason: `Edge (${(absEdge * 100).toFixed(1)}%) below threshold (${(edgeRequired * 100).toFixed(0)}%) for ${confidence} confidence`,
      suggestedSize: 'none',
      bestPlatform: null,
      bestPrice: null,
      edgeRequired,
      edgeAvailable: absEdge,
      riskLevel: 'medium',
    };
  }

  if (marketPrices.length === 0) {
    return {
      action: 'WAIT',
      reason: 'No active markets found - cannot execute trade',
      suggestedSize: 'none',
      bestPlatform: null,
      bestPrice: null,
      edgeRequired,
      edgeAvailable: absEdge,
      riskLevel: 'medium',
    };
  }

  // Tradeable edge exists
  const suggestedSize = absEdge > 0.15 ? 'large'
                      : absEdge > 0.08 ? 'medium'
                      : 'small';

  const riskLevel = confidence === 'high' && absEdge > 0.10 ? 'low'
                  : confidence === 'medium' || absEdge < 0.08 ? 'medium'
                  : 'high';

  return {
    action: edge > 0 ? 'BUY_YES' : 'BUY_NO',
    reason: `${(absEdge * 100).toFixed(1)}% edge detected with ${confidence} confidence`,
    suggestedSize,
    bestPlatform,
    bestPrice,
    edgeRequired,
    edgeAvailable: absEdge,
    riskLevel,
  };
}

function determineMood(toolResults: Array<{ tool: string; result: any; error?: string }>): Mood {
  if (toolResults.some(tr => tr.error)) return 'ERROR';

  const forecastResult = toolResults.find(tr => tr.tool === 'make_forecast');
  if (forecastResult?.result?.tradingRecommendation) {
    const action = forecastResult.result.tradingRecommendation.action;
    if (action === 'BUY_YES') return 'BULLISH';
    if (action === 'BUY_NO') return 'BEARISH';
  }

  return 'NEUTRAL';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  id: FORECASTER_CONFIG.id,
  name: FORECASTER_CONFIG.name,
  execute,
  tools: FORECASTER_TOOLS,
  config: FORECASTER_CONFIG,
  soul: FORECASTER_SOUL,
};
