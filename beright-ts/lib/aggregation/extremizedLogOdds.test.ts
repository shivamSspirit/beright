/**
 * Extremized Log-Odds Aggregation Tests
 *
 * Tests for the state-of-the-art probability aggregation module.
 * Run with: npx ts-node lib/aggregation/extremizedLogOdds.test.ts
 *
 * @author BeRight Protocol
 */

import {
  toLogOdds,
  fromLogOdds,
  calculatePlatformWeight,
  extremizedLogOddsAggregate,
  adaptiveExtremizedAggregate,
  calculateEdge,
  calculateExtremizedConsensus,
  calculateAdaptiveExtremizingFactor,
  DEFAULT_EXTREMIZING_CONFIG,
  type LogOddsInput,
} from './extremizedLogOdds';

// =============================================================================
// TEST HELPERS
// =============================================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.error(`  ✗ ${message}`);
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, message: string): void {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    testsPassed++;
    console.log(`  ✓ ${message} (${actual.toFixed(4)} ≈ ${expected.toFixed(4)})`);
  } else {
    testsFailed++;
    console.error(`  ✗ ${message} (got ${actual.toFixed(4)}, expected ${expected.toFixed(4)}, diff ${diff.toFixed(4)})`);
  }
}

function describe(name: string, fn: () => void): void {
  console.log(`\n📋 ${name}`);
  fn();
}

function it(name: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    testsFailed++;
    console.error(`  ✗ ${name}: ${error}`);
  }
}

// =============================================================================
// LOG-ODDS CONVERSION TESTS
// =============================================================================

describe('toLogOdds / fromLogOdds conversions', () => {
  it('should convert 0.5 to log-odds 0', () => {
    const logOdds = toLogOdds(0.5);
    assertApprox(logOdds, 0, 0.0001, 'P=0.5 → log-odds=0');
  });

  it('should convert 0.75 to positive log-odds', () => {
    const logOdds = toLogOdds(0.75);
    assert(logOdds > 0, 'P=0.75 should give positive log-odds');
    assertApprox(logOdds, 1.0986, 0.001, 'P=0.75 → log-odds≈1.099');
  });

  it('should convert 0.25 to negative log-odds', () => {
    const logOdds = toLogOdds(0.25);
    assert(logOdds < 0, 'P=0.25 should give negative log-odds');
    assertApprox(logOdds, -1.0986, 0.001, 'P=0.25 → log-odds≈-1.099');
  });

  it('should clamp extreme probabilities', () => {
    const logOddsLow = toLogOdds(0.001);
    const logOddsHigh = toLogOdds(0.999);
    assert(isFinite(logOddsLow), 'Very low probability should be finite');
    assert(isFinite(logOddsHigh), 'Very high probability should be finite');
  });

  it('should be reversible (round-trip)', () => {
    const testValues = [0.1, 0.25, 0.5, 0.75, 0.9];
    for (const p of testValues) {
      const roundTrip = fromLogOdds(toLogOdds(p));
      assertApprox(roundTrip, p, 0.0001, `Round-trip P=${p}`);
    }
  });
});

// =============================================================================
// PLATFORM WEIGHT TESTS
// =============================================================================

describe('calculatePlatformWeight', () => {
  it('should weight Kalshi higher than Manifold (better calibration)', () => {
    const kalshiWeight = calculatePlatformWeight({
      platform: 'kalshi',
      probability: 0.5,
      volume: 1000,
      liquidity: 1000,
    });
    const manifoldWeight = calculatePlatformWeight({
      platform: 'manifold',
      probability: 0.5,
      volume: 1000,
      liquidity: 1000,
    });
    assert(kalshiWeight > manifoldWeight, 'Kalshi should have higher weight than Manifold');
  });

  it('should increase weight with volume', () => {
    const lowVolume = calculatePlatformWeight({
      platform: 'polymarket',
      probability: 0.5,
      volume: 100,
      liquidity: 1000,
    });
    const highVolume = calculatePlatformWeight({
      platform: 'polymarket',
      probability: 0.5,
      volume: 10000,
      liquidity: 1000,
    });
    assert(highVolume > lowVolume, 'Higher volume should increase weight');
  });

  it('should increase weight with liquidity', () => {
    const lowLiquidity = calculatePlatformWeight({
      platform: 'polymarket',
      probability: 0.5,
      volume: 1000,
      liquidity: 100,
    });
    const highLiquidity = calculatePlatformWeight({
      platform: 'polymarket',
      probability: 0.5,
      volume: 1000,
      liquidity: 10000,
    });
    assert(highLiquidity > lowLiquidity, 'Higher liquidity should increase weight');
  });
});

// =============================================================================
// EXTREMIZED LOG-ODDS AGGREGATION TESTS
// =============================================================================

describe('extremizedLogOddsAggregate', () => {
  it('should return 0.5 for empty inputs', () => {
    const result = extremizedLogOddsAggregate([]);
    assertApprox(result.probability, 0.5, 0.0001, 'Empty inputs → 0.5');
    assert(result.confidence === 0, 'Empty inputs should have 0 confidence');
  });

  it('should handle single platform input', () => {
    const result = extremizedLogOddsAggregate([
      { platform: 'polymarket', probability: 0.7, volume: 1000, liquidity: 5000 },
    ]);
    assert(result.probability > 0.5, 'Single 0.7 input should be > 0.5');
    assert(result.confidence < 0.5, 'Single source should have low confidence');
  });

  it('should aggregate multiple platforms correctly', () => {
    const result = extremizedLogOddsAggregate([
      { platform: 'kalshi', probability: 0.65, volume: 10000, liquidity: 50000 },
      { platform: 'polymarket', probability: 0.70, volume: 15000, liquidity: 80000 },
      { platform: 'metaculus', probability: 0.68, volume: 5000, liquidity: 20000 },
    ]);

    // Should be somewhere in the range but extremized
    assert(result.probability > 0.6, 'Aggregated probability should be > 0.6');
    assert(result.probability < 0.85, 'Aggregated probability should be < 0.85');
    assert(result.confidence > 0.5, 'Multiple sources should have reasonable confidence');
    assert(result.method === 'extremized_log_odds', 'Method should be extremized_log_odds');
  });

  it('should extremize away from 0.5', () => {
    const inputs: LogOddsInput[] = [
      { platform: 'kalshi', probability: 0.6, volume: 1000, liquidity: 5000 },
      { platform: 'polymarket', probability: 0.6, volume: 1000, liquidity: 5000 },
    ];

    // With no extremizing
    const noExtreme = extremizedLogOddsAggregate(inputs, {
      ...DEFAULT_EXTREMIZING_CONFIG,
      extremizingFactor: 1.0,
    });

    // With extremizing
    const withExtreme = extremizedLogOddsAggregate(inputs, {
      ...DEFAULT_EXTREMIZING_CONFIG,
      extremizingFactor: 1.5,
    });

    assert(withExtreme.probability > noExtreme.probability,
      'Extremizing should push probability away from 0.5 (toward 1.0 when > 0.5)');
  });

  it('should weight high-volume platforms more', () => {
    const highVolumeKalshi = extremizedLogOddsAggregate([
      { platform: 'kalshi', probability: 0.8, volume: 100000, liquidity: 50000 },
      { platform: 'manifold', probability: 0.4, volume: 100, liquidity: 500 },
    ]);

    // Kalshi at 0.8 with high volume should dominate Manifold at 0.4 with low volume
    assert(highVolumeKalshi.probability > 0.6,
      'High volume Kalshi should dominate low volume Manifold');
  });
});

// =============================================================================
// ADAPTIVE EXTREMIZING TESTS
// =============================================================================

describe('calculateAdaptiveExtremizingFactor', () => {
  it('should return 1.0 for single source (no extremizing)', () => {
    const factor = calculateAdaptiveExtremizingFactor([
      { platform: 'polymarket', probability: 0.7, volume: 1000, liquidity: 5000 },
    ]);
    assertApprox(factor, 1.0, 0.0001, 'Single source → factor = 1.0');
  });

  it('should increase factor with more platforms', () => {
    const twoSources = calculateAdaptiveExtremizingFactor([
      { platform: 'kalshi', probability: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'polymarket', probability: 0.7, volume: 1000, liquidity: 5000 },
    ]);

    const fiveSources = calculateAdaptiveExtremizingFactor([
      { platform: 'kalshi', probability: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'polymarket', probability: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'metaculus', probability: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'manifold', probability: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'jupiter', probability: 0.7, volume: 1000, liquidity: 5000 },
    ]);

    assert(fiveSources > twoSources, 'More sources should increase extremizing factor');
  });

  it('should stay within reasonable bounds (1.0 to 2.0)', () => {
    const factor = calculateAdaptiveExtremizingFactor([
      { platform: 'kalshi', probability: 0.3, volume: 1000, liquidity: 5000 },
      { platform: 'polymarket', probability: 0.9, volume: 1000, liquidity: 5000 },
      { platform: 'metaculus', probability: 0.5, volume: 1000, liquidity: 5000 },
    ]);
    assert(factor >= 1.0, 'Factor should be >= 1.0');
    assert(factor <= 2.0, 'Factor should be <= 2.0');
  });
});

// =============================================================================
// EDGE CALCULATION TESTS
// =============================================================================

describe('calculateEdge', () => {
  it('should detect positive edge (YES underpriced)', () => {
    const edge = calculateEdge(
      0.75, // AI thinks 75%
      [
        { platform: 'polymarket', probability: 0.60, volume: 10000, liquidity: 50000 },
        { platform: 'kalshi', probability: 0.58, volume: 8000, liquidity: 40000 },
      ]
    );

    assert(edge.edge > 0, 'AI higher than market → positive edge');
    assert(edge.direction === 'YES', 'Positive edge should suggest YES');
    assert(edge.kellyFraction > 0, 'Kelly fraction should be positive');
  });

  it('should detect negative edge (YES overpriced / NO underpriced)', () => {
    const edge = calculateEdge(
      0.40, // AI thinks 40%
      [
        { platform: 'polymarket', probability: 0.60, volume: 10000, liquidity: 50000 },
        { platform: 'kalshi', probability: 0.62, volume: 8000, liquidity: 40000 },
      ]
    );

    assert(edge.edge < 0, 'AI lower than market → negative edge');
    assert(edge.direction === 'NO', 'Negative edge should suggest NO');
  });

  it('should return NEUTRAL for small edge', () => {
    const edge = calculateEdge(
      0.51, // AI thinks 51%
      [
        { platform: 'polymarket', probability: 0.50, volume: 10000, liquidity: 50000 },
      ]
    );

    assert(edge.direction === 'NEUTRAL', 'Small edge should be NEUTRAL');
  });

  it('should calculate Kelly fraction correctly', () => {
    const edge = calculateEdge(
      0.70, // AI thinks 70%
      [
        { platform: 'polymarket', probability: 0.50, volume: 10000, liquidity: 50000 },
      ]
    );

    assert(edge.kellyFraction > 0, 'Kelly should be positive for positive edge');
    assert(edge.halfKelly <= edge.kellyFraction, 'Half Kelly should be <= full Kelly');
    assert(edge.suggestedSize <= 0.025, 'Suggested size should be capped at 2.5%');
  });

  it('should calculate actionable edge after fees', () => {
    const edge = calculateEdge(
      0.65,
      [
        { platform: 'polymarket', probability: 0.55, volume: 10000, liquidity: 50000 },
      ]
    );

    assert(edge.actionableEdge < edge.edgeMagnitude, 'Actionable edge should be less than raw edge (fees deducted)');
  });

  it('should mark large edge as actionable', () => {
    const edge = calculateEdge(
      0.80,
      [
        { platform: 'polymarket', probability: 0.55, volume: 10000, liquidity: 50000 },
        { platform: 'kalshi', probability: 0.52, volume: 8000, liquidity: 40000 },
      ]
    );

    assert(edge.isActionable === true, 'Large edge with good confidence should be actionable');
  });
});

// =============================================================================
// CONSENSUS CALCULATION TESTS
// =============================================================================

describe('calculateExtremizedConsensus', () => {
  it('should return 0.5 for empty array', () => {
    const result = extremizedLogOddsAggregate([]);
    assertApprox(result.probability, 0.5, 0.0001, 'Empty array → 0.5');
  });

  it('should handle identical prices', () => {
    const consensus = calculateExtremizedConsensus([
      { platform: 'kalshi', yesPrice: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'polymarket', yesPrice: 0.7, volume: 1000, liquidity: 5000 },
      { platform: 'metaculus', yesPrice: 0.7, volume: 1000, liquidity: 5000 },
    ]);

    // With extremizing, should be pushed further from 0.5
    assert(consensus > 0.7, 'Identical 0.7 prices should extremize to > 0.7');
  });

  it('should handle mixed prices (arbitrage scenario)', () => {
    const consensus = calculateExtremizedConsensus([
      { platform: 'kalshi', yesPrice: 0.55, volume: 10000, liquidity: 50000 },
      { platform: 'polymarket', yesPrice: 0.65, volume: 15000, liquidity: 80000 },
    ]);

    // Should be somewhere in the middle, weighted by volume/liquidity
    assert(consensus > 0.55, 'Consensus should be > lowest price');
    assert(consensus < 0.75, 'Consensus should be < highest price (with extremizing)');
  });
});

// =============================================================================
// COMPARISON WITH SIMPLE AVERAGE
// =============================================================================

describe('Comparison: Extremized vs Simple Average', () => {
  it('should differ from simple average for extreme probabilities', () => {
    const inputs: LogOddsInput[] = [
      { platform: 'kalshi', probability: 0.9, volume: 1000, liquidity: 5000 },
      { platform: 'polymarket', probability: 0.85, volume: 1000, liquidity: 5000 },
    ];

    // Simple average
    const simpleAvg = (0.9 + 0.85) / 2; // = 0.875

    // Extremized log-odds
    const extremized = extremizedLogOddsAggregate(inputs);

    // Extremized should push further toward certainty (> 0.875)
    console.log(`  📊 Simple avg: ${simpleAvg.toFixed(4)}, Extremized: ${extremized.probability.toFixed(4)}`);
    assert(extremized.probability > simpleAvg,
      'Extremized should be higher than simple average for high probabilities');
  });

  it('should preserve tail information better than linear avg', () => {
    const inputs: LogOddsInput[] = [
      { platform: 'kalshi', probability: 0.95, volume: 10000, liquidity: 50000 },
      { platform: 'polymarket', probability: 0.05, volume: 1000, liquidity: 5000 },
    ];

    // Simple average would be 0.5
    const simpleAvg = (0.95 + 0.05) / 2; // = 0.5

    // Log-odds average preserves that Kalshi (high vol) says 95%
    const extremized = extremizedLogOddsAggregate(inputs);

    console.log(`  📊 Simple avg: ${simpleAvg.toFixed(4)}, Extremized: ${extremized.probability.toFixed(4)}`);
    assert(extremized.probability > 0.5,
      'Extremized should weight high-volume Kalshi at 0.95 more heavily');
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe('Edge Cases', () => {
  it('should handle probability at 0.01 (near zero)', () => {
    const result = extremizedLogOddsAggregate([
      { platform: 'polymarket', probability: 0.01, volume: 1000, liquidity: 5000 },
    ]);
    assert(result.probability >= 0.01, 'Should handle near-zero probability');
    assert(isFinite(result.probability), 'Result should be finite');
  });

  it('should handle probability at 0.99 (near one)', () => {
    const result = extremizedLogOddsAggregate([
      { platform: 'polymarket', probability: 0.99, volume: 1000, liquidity: 5000 },
    ]);
    assert(result.probability <= 0.99, 'Should handle near-one probability');
    assert(isFinite(result.probability), 'Result should be finite');
  });

  it('should handle missing volume/liquidity', () => {
    const result = extremizedLogOddsAggregate([
      { platform: 'polymarket', probability: 0.6 },
      { platform: 'kalshi', probability: 0.65 },
    ]);
    assert(isFinite(result.probability), 'Should handle missing volume/liquidity');
    assert(result.probability > 0.5, 'Should still aggregate correctly');
  });

  it('should handle unknown platform', () => {
    const result = extremizedLogOddsAggregate([
      { platform: 'unknown_platform' as any, probability: 0.7, volume: 1000, liquidity: 5000 },
    ]);
    assert(isFinite(result.probability), 'Should handle unknown platform');
  });
});

// =============================================================================
// RUN TESTS
// =============================================================================

console.log('\n🧪 Running Extremized Log-Odds Aggregation Tests\n');
console.log('=' .repeat(60));

// Run all test suites
try {
  // All describes are already executed above

  console.log('\n' + '=' .repeat(60));
  console.log(`\n📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);

  if (testsFailed > 0) {
    console.log('\n❌ Some tests failed!');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
} catch (error) {
  console.error('\n💥 Test suite crashed:', error);
  process.exit(1);
}
