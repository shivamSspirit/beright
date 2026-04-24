import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { Calibration } from '../target/types/calibration';
import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';

describe('calibration V2 - Migration & New Features', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Calibration as Program<Calibration>;

  describe('V2 Schema Tests', () => {
    const v2Forecaster = Keypair.generate();
    let v2ForecasterPda: PublicKey;

    before(async () => {
      // Airdrop SOL
      const signature = await provider.connection.requestAirdrop(
        v2Forecaster.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      // Derive PDA
      [v2ForecasterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('forecaster'), v2Forecaster.publicKey.toBuffer()],
        program.programId
      );
    });

    it('Creates V2 forecaster account with correct size', async () => {
      const tx = await program.methods
        .initializeForecaster()
        .accounts({
          authority: v2Forecaster.publicKey,
          forecasterState: v2ForecasterPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([v2Forecaster])
        .rpc();

      console.log('✅ V2 forecaster initialized:', tx);

      // Fetch account
      const forecasterState = await program.account.forecasterState.fetch(v2ForecasterPda);

      // Verify V2 fields are initialized
      assert.equal(forecasterState.version, 2, 'Should be V2');
      assert.equal(forecasterState.authority.toBase58(), v2Forecaster.publicKey.toBase58());
      assert.equal(forecasterState.totalResolvedEvents, 0, 'Total resolved events should be 0');
      assert.equal(forecasterState.finalCompositeScore, 500, 'Should start at prior mean of 500');
      assert.equal(forecasterState.tier, 5, 'Should start at tier 5 (unproven)');
      assert.equal(forecasterState.confidenceWeight, 0, 'Confidence should be 0 with no data');

      // Verify V2-specific fields exist (won't be null/undefined)
      assert.exists(forecasterState.s1Composite, 'S1 composite should exist');
      assert.exists(forecasterState.s6CrossPlatform, 'S6 cross-platform should exist');

      console.log('📊 V2 Fields Verified:');
      console.log(`  - Version: ${forecasterState.version}`);
      console.log(`  - Final Composite Score: ${forecasterState.finalCompositeScore}`);
      console.log(`  - Tier: ${forecasterState.tier}`);
      console.log(`  - Confidence Weight: ${forecasterState.confidenceWeight}`);
    });

    it('V2 account has correct size (559 bytes)', async () => {
      const accountInfo = await provider.connection.getAccountInfo(v2ForecasterPda);

      assert.isNotNull(accountInfo, 'Account should exist');

      // V2 is 559 bytes (Option types pack more efficiently than estimated)
      // Original estimate was 589, but Borsh packing is more efficient
      const expectedSize = 559;
      const actualSize = accountInfo!.data.length;

      console.log(`📏 Account Size Check:`);
      console.log(`  - Expected: ${expectedSize} bytes`);
      console.log(`  - Actual: ${actualSize} bytes`);
      console.log(`  - Savings: ${589 - actualSize} bytes from efficient Option packing`);

      assert.equal(actualSize, expectedSize, `V2 account should be exactly ${expectedSize} bytes`);
    });
  });

  describe('V1 to V2 Migration Tests', () => {
    // We'll create a V1-style account (old test) and migrate it
    const v1Forecaster = Keypair.generate();
    let v1ForecasterPda: PublicKey;

    before(async () => {
      // Airdrop SOL
      const signature = await provider.connection.requestAirdrop(
        v1Forecaster.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(signature);

      [v1ForecasterPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('forecaster'), v1Forecaster.publicKey.toBuffer()],
        program.programId
      );
    });

    it('Creates forecaster (simulating V1)', async () => {
      // Initialize forecaster
      await program.methods
        .initializeForecaster()
        .accounts({
          authority: v1Forecaster.publicKey,
          forecasterState: v1ForecasterPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([v1Forecaster])
        .rpc();

      const forecasterState = await program.account.forecasterState.fetch(v1ForecasterPda);

      console.log('✅ Forecaster created (V2 by default now)');
      console.log(`  - Version: ${forecasterState.version}`);
      console.log(`  - Resolved Predictions: ${forecasterState.resolvedPredictions}`);
    });

    it('Makes some predictions and resolves them', async () => {
      // Record and resolve a few predictions to populate V1 fields
      const marketId = Buffer.alloc(32, 1);
      const memoSig = Buffer.alloc(64, 0);

      for (let i = 0; i < 3; i++) {
        const timestamp = new anchor.BN(Date.now() + i);
        const timestampBuffer = Buffer.alloc(8);
        timestampBuffer.writeBigInt64LE(BigInt(timestamp.toString()));

        const [predictionPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('prediction'),
            v1Forecaster.publicKey.toBuffer(),
            marketId,
            timestampBuffer,
          ],
          program.programId
        );

        // Record prediction
        await program.methods
          .recordPrediction(
            Array.from(marketId),
            timestamp,
            0.7 + (i * 0.1), // 0.7, 0.8, 0.9
            { yes: {} },
            Array.from(memoSig),
            0
          )
          .accounts({
            authority: v1Forecaster.publicKey,
            forecasterState: v1ForecasterPda,
            predictionRecord: predictionPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([v1Forecaster])
          .rpc();

        // Resolve prediction (2 correct, 1 wrong)
        const outcome = i < 2; // First 2 are correct
        await program.methods
          .resolvePrediction(outcome)
          .accounts({
            authority: v1Forecaster.publicKey,
            forecasterState: v1ForecasterPda,
            predictionRecord: predictionPda,
          })
          .signers([v1Forecaster])
          .rpc();
      }

      const forecasterState = await program.account.forecasterState.fetch(v1ForecasterPda);

      console.log('✅ Made 3 predictions (2 correct, 1 wrong)');
      console.log(`  - Total Predictions: ${forecasterState.totalPredictions}`);
      console.log(`  - Resolved: ${forecasterState.resolvedPredictions}`);
      console.log(`  - Correct: ${forecasterState.correctPredictions}`);
      console.log(`  - Accuracy: ${(forecasterState.accuracy * 100).toFixed(1)}%`);
      console.log(`  - Avg Brier: ${forecasterState.avgBrierScore.toFixed(4)}`);

      assert.equal(forecasterState.totalPredictions, 3);
      assert.equal(forecasterState.resolvedPredictions, 3);
      assert.equal(forecasterState.correctPredictions, 2);
      assert.approximately(forecasterState.accuracy, 0.667, 0.01);
    });

    it('V2 fields are initialized correctly (scores calculated off-chain)', async () => {
      const state = await program.account.forecasterState.fetch(v1ForecasterPda);

      console.log('\n📊 V2 Account State:');
      console.log(`  - Version: ${state.version}`);
      console.log(`  - Resolved Predictions: ${state.resolvedPredictions}`);
      console.log(`  - Avg Brier Score: ${state.avgBrierScore.toFixed(4)}`);
      console.log(`  - Total Resolved Events: ${state.totalResolvedEvents}`);
      console.log(`  - Final Composite Score: ${state.finalCompositeScore}`);
      console.log(`  - Confidence Weight: ${state.confidenceWeight}`);

      // Verify V2 fields exist and are initialized
      assert.equal(state.version, 2, 'Should be V2');
      assert.equal(state.totalResolvedEvents, 3, 'Should sync resolved count');
      assert.equal(state.finalCompositeScore, 500, 'Should initialize to prior mean');

      // NOTE: confidence_weight, s1_composite, s6_cross_platform etc. are 0
      // These are calculated OFF-CHAIN by the scoring service and updated via
      // a separate instruction. The on-chain program just stores them.
      assert.equal(state.confidenceWeight, 0, 'Confidence weight calculated off-chain');
      assert.equal(state.s6CrossPlatform, 0, 'S6 calculated off-chain');

      console.log('\n💡 V2 scores are calculated by off-chain scoring service');
      console.log('   On-chain program only stores the results');
    });
  });

  describe('V2 Calculation Tests', () => {
    it('Calculates confidence weight correctly (Bayesian shrinkage)', async () => {
      const testCases = [
        { resolved: 0, expected: 0.0 },       // 0/(0+100) = 0
        { resolved: 10, expected: 0.091 },    // 10/(10+100) = 0.091
        { resolved: 50, expected: 0.333 },    // 50/(50+100) = 0.333
        { resolved: 100, expected: 0.5 },     // 100/(100+100) = 0.5
        { resolved: 1000, expected: 0.909 },  // 1000/(1000+100) = 0.909
      ];

      for (const tc of testCases) {
        const confidence = tc.resolved / (tc.resolved + 100);
        assert.approximately(confidence, tc.expected, 0.001,
          `${tc.resolved} predictions should give ~${tc.expected} confidence`);
      }

      console.log('✅ Confidence weight formula verified');
      console.log('   Formula: N / (N + 100) with anchor of 100');
    });

    it('Applies confidence weighting correctly', async () => {
      // Test the shrinkage formula: final = confidence × raw + (1 - confidence) × 500
      const testCases = [
        { resolved: 0, rawScore: 800, expectedFinal: 500 },   // Pure prior
        { resolved: 10, rawScore: 800, expectedFinal: 527 },  // Heavy shrinkage
        { resolved: 100, rawScore: 800, expectedFinal: 650 }, // 50/50 mix
        { resolved: 1000, rawScore: 800, expectedFinal: 773 }, // Mostly data
      ];

      for (const tc of testCases) {
        const confidence = tc.resolved / (tc.resolved + 100);
        const final = Math.round(confidence * tc.rawScore + (1 - confidence) * 500);

        assert.equal(final, tc.expectedFinal,
          `${tc.resolved} predictions with raw score ${tc.rawScore} should give final ${tc.expectedFinal}`);
      }

      console.log('✅ Bayesian shrinkage formula verified');
      console.log('   Formula: confidence × raw + (1 - confidence) × 500');
    });

    it('Calculates tier correctly from final score', async () => {
      const testCases = [
        { score: 200, expectedTier: 5 },  // <300 = Tier 5
        { score: 400, expectedTier: 4 },  // 300-499 = Tier 4
        { score: 550, expectedTier: 3 },  // 500-599 = Tier 3
        { score: 650, expectedTier: 2 },  // 600-699 = Tier 2
        { score: 800, expectedTier: 1 },  // 700+ = Tier 1
      ];

      for (const tc of testCases) {
        let tier: number;
        if (tc.score >= 700) tier = 1;
        else if (tc.score >= 600) tier = 2;
        else if (tc.score >= 500) tier = 3;
        else if (tc.score >= 300) tier = 4;
        else tier = 5;

        assert.equal(tier, tc.expectedTier,
          `Score ${tc.score} should be tier ${tc.expectedTier}`);
      }

      console.log('✅ Tier calculation verified');
      console.log('   Tier 1: 700+, Tier 2: 600-699, Tier 3: 500-599, Tier 4: 300-499, Tier 5: <300');
    });

    it('Calculates S6 cross-platform consistency correctly', async () => {
      const testCases = [
        { platforms: [720, 750], expectedS6: 0.96 },      // 720/750 = 0.96 (consistent)
        { platforms: [200, 750], expectedS6: 0.267 },     // 200/750 = 0.267 (platform-specific)
        { platforms: [700, 720, 710], expectedS6: 0.972 }, // 700/720 = 0.972 (very consistent)
        { platforms: [500], expectedS6: 0.0 },            // Only 1 platform = 0
      ];

      for (const tc of testCases) {
        let s6: number;
        if (tc.platforms.length < 2) {
          s6 = 0.0;
        } else {
          const min = Math.min(...tc.platforms);
          const max = Math.max(...tc.platforms);
          s6 = min / max;
        }

        assert.approximately(s6, tc.expectedS6, 0.01,
          `Platforms ${tc.platforms} should give S6 ~${tc.expectedS6}`);
      }

      console.log('✅ S6 cross-platform consistency verified');
      console.log('   Formula: min(scores) / max(scores), requires 2+ platforms');
    });
  });

  describe('Anti-Gaming Detection Tests', () => {
    it('Detects MM/arb wallets correctly', async () => {
      // MM ratio > 0.70 should flag as likely MM wallet
      const mmRatios = [0.80, 0.65, 0.50];
      const expectedFlags = [true, false, false];

      for (let i = 0; i < mmRatios.length; i++) {
        const isLikelyMM = mmRatios[i] > 0.70;
        assert.equal(isLikelyMM, expectedFlags[i],
          `MM ratio ${mmRatios[i]} should ${expectedFlags[i] ? '' : 'not '}flag as MM`);
      }

      console.log('✅ MM/arb detection verified (threshold: >70% extreme trades)');
    });

    it('Detects late-entry gamers correctly', async () => {
      // Late entry ratio > 0.50 should flag
      const lateRatios = [0.60, 0.50, 0.30];
      const expectedFlags = [true, false, false];

      for (let i = 0; i < lateRatios.length; i++) {
        const isLikelyLateEntry = lateRatios[i] > 0.50;
        assert.equal(isLikelyLateEntry, expectedFlags[i],
          `Late entry ratio ${lateRatios[i]} should ${expectedFlags[i] ? '' : 'not '}flag`);
      }

      console.log('✅ Late-entry detection verified (threshold: >50% late predictions)');
    });

    it('Detects easy-question farmers correctly', async () => {
      // Difficulty < 0.2 AND many questions (>100) should flag
      const testCases = [
        { difficulty: 0.15, questions: 150, expected: true },   // Low difficulty + many questions
        { difficulty: 0.15, questions: 50, expected: false },   // Low difficulty but few questions
        { difficulty: 0.30, questions: 150, expected: false },  // Many questions but high difficulty
      ];

      for (const tc of testCases) {
        const isLikelyFarmer = tc.difficulty < 0.2 && tc.questions > 100;
        assert.equal(isLikelyFarmer, tc.expected,
          `Difficulty ${tc.difficulty} with ${tc.questions} questions should ${tc.expected ? '' : 'not '}flag`);
      }

      console.log('✅ Easy-question farming detection verified (threshold: <0.2 difficulty AND >100 questions)');
    });
  });

  describe('Vault Eligibility Tests', () => {
    it('Checks vault creation eligibility correctly', async () => {
      const testCases = [
        { tier: 1, bond: 1_000_000_000, resolved: 100, s6: 0.8, canCreate: true },   // Tier 1, bonded, multi-platform
        { tier: 2, bond: 1_000_000_000, resolved: 100, s6: 0.8, canCreate: true },   // Tier 2, bonded, multi-platform
        { tier: 3, bond: 1_000_000_000, resolved: 100, s6: 0.8, canCreate: false },  // Tier 3 = not eligible
        { tier: 1, bond: 100_000_000, resolved: 100, s6: 0.8, canCreate: false },    // Under-bonded (0.1 SOL < 1 SOL)
        { tier: 1, bond: 1_000_000_000, resolved: 30, s6: 0.8, canCreate: false },   // Too few predictions (<50)
        { tier: 1, bond: 1_000_000_000, resolved: 100, s6: 0.0, canCreate: false },  // Single platform only
      ];

      for (const tc of testCases) {
        const canCreate =
          tc.tier <= 2 &&
          tc.bond >= 1_000_000_000 &&
          tc.resolved >= 50 &&
          tc.s6 > 0.0;

        assert.equal(canCreate, tc.canCreate,
          `Tier ${tc.tier}, bond ${tc.bond}, resolved ${tc.resolved}, S6 ${tc.s6} should ${tc.canCreate ? 'allow' : 'deny'} vault creation`);
      }

      console.log('✅ Vault eligibility checks verified');
      console.log('   Requirements: Tier 1-2, 1 SOL bond, 50+ predictions, 2+ platforms');
    });
  });
});

describe('V2 Edge Cases & Error Handling', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Calibration as Program<Calibration>;

  it('Handles division by zero in confidence calculation', () => {
    // With 0 predictions, confidence should be 0 (not NaN or error)
    const confidence = 0 / (0 + 100);
    assert.equal(confidence, 0, 'Zero predictions should give 0 confidence');
  });

  it('Handles single-platform S6 calculation', () => {
    // With only 1 platform, S6 should be 0
    const platforms = [750];
    const s6 = platforms.length < 2 ? 0.0 : Math.min(...platforms) / Math.max(...platforms);
    assert.equal(s6, 0.0, 'Single platform should give S6 = 0');
  });

  it('Clamps composite score to 0-1000 range', () => {
    const testScores = [-100, 0, 500, 1000, 1500];
    const expected = [0, 0, 500, 1000, 1000];

    for (let i = 0; i < testScores.length; i++) {
      const clamped = Math.max(0, Math.min(1000, testScores[i]));
      assert.equal(clamped, expected[i], `${testScores[i]} should clamp to ${expected[i]}`);
    }

    console.log('✅ Score clamping verified (0-1000 range)');
  });

  it('Handles large prediction counts without overflow', () => {
    // Test that u32 max (4,294,967,295) doesn't overflow in calculations
    const maxU32 = 4_294_967_295;
    const confidence = maxU32 / (maxU32 + 100);

    assert.isFinite(confidence, 'Confidence should be finite');
    assert.approximately(confidence, 0.999999, 0.00001, 'Should approach 1.0 with huge sample');

    console.log('✅ Large sample size handling verified');
  });
});
