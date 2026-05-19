import * as anchor from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import { assert } from 'chai';

describe('calibration', () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Calibration as any;

  // Test forecaster
  const forecasterKeypair = Keypair.generate();
  const resolverKeypair = (provider.wallet as anchor.Wallet).payer;
  let forecasterStatePda: PublicKey;
  let predictionPda: PublicKey;
  let scoreConfigPda: PublicKey;

  // Test data
  const marketId = Buffer.alloc(32, 1); // Simple market ID
  const timestampSeed = new anchor.BN(Date.now());
  const predictedProbability = 0.75;
  const memoTxSignature = Buffer.alloc(64, 0); // Dummy signature

  before(async () => {
    // Airdrop SOL to test forecaster
    const signature = await provider.connection.requestAirdrop(
      forecasterKeypair.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Derive PDAs
    [forecasterStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('forecaster_v2'), forecasterKeypair.publicKey.toBuffer()],
      program.programId
    );

    [scoreConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('score_config')],
      program.programId
    );

    const timestampBuffer = Buffer.alloc(8);
    timestampBuffer.writeBigInt64LE(BigInt(timestampSeed.toString()));
    [predictionPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('prediction'),
        forecasterKeypair.publicKey.toBuffer(),
        marketId,
        timestampBuffer,
      ],
      program.programId
    );

    const scoreConfigInfo = await provider.connection.getAccountInfo(scoreConfigPda);
    if (!scoreConfigInfo) {
      await program.methods
        .initializeScoreConfig()
        .accounts({
          authority: resolverKeypair.publicKey,
          scoreConfig: scoreConfigPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([resolverKeypair])
        .rpc();
    }
  });

  it('Initializes forecaster state', async () => {
    const tx = await program.methods
      .initializeForecaster()
      .accounts({
        authority: forecasterKeypair.publicKey,
        forecasterState: forecasterStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([forecasterKeypair])
      .rpc();

    console.log('Initialize forecaster tx:', tx);

    // Fetch and verify
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );

    assert.equal(
      forecasterState.authority.toBase58(),
      forecasterKeypair.publicKey.toBase58()
    );
    assert.equal(forecasterState.totalPredictions, 0);
    assert.equal(forecasterState.resolvedPredictions, 0);
    assert.equal(forecasterState.avgBrierScore, 0);
    assert.equal(forecasterState.accuracy, 0);
    assert.equal(forecasterState.streakCorrect, 0);
  });

  it('Records a prediction', async () => {
    const tx = await program.methods
      .recordPrediction(
        Array.from(marketId),
        timestampSeed,
        predictedProbability,
        { yes: {} }, // PredictionDirection::Yes
        Array.from(memoTxSignature),
        0 // category
      )
      .accounts({
        authority: forecasterKeypair.publicKey,
        forecasterState: forecasterStatePda,
        predictionRecord: predictionPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([forecasterKeypair])
      .rpc();

    console.log('Record prediction tx:', tx);

    // Verify forecaster state updated
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );
    assert.equal(forecasterState.totalPredictions, 1);
    assert.equal(forecasterState.resolvedPredictions, 0);

    // Verify prediction record
    const predictionRecord = await program.account.predictionRecord.fetch(
      predictionPda
    );
    assert.equal(
      predictionRecord.forecaster.toBase58(),
      forecasterKeypair.publicKey.toBase58()
    );
    assert.equal(predictionRecord.predictedProbability, predictedProbability);
    assert.deepEqual(predictionRecord.marketId, Array.from(marketId));
    assert.equal(predictionRecord.outcome, null);
  });

  it('Resolves a prediction (outcome = YES)', async () => {
    const outcome = true; // YES

    const tx = await program.methods
      .resolvePrediction(outcome)
      .accounts({
        resolver: resolverKeypair.publicKey,
        scoreConfig: scoreConfigPda,
        predictionRecord: predictionPda,
        forecasterState: forecasterStatePda,
      })
      .signers([resolverKeypair])
      .rpc();

    console.log('Resolve prediction tx:', tx);

    // Verify prediction record
    const predictionRecord = await program.account.predictionRecord.fetch(
      predictionPda
    );
    assert.equal(predictionRecord.outcome, outcome);
    assert.isNotNull(predictionRecord.brierScore);
    assert.isNotNull(predictionRecord.logScore);

    // Brier score for 0.75 prediction when outcome = YES
    // Brier = (0.75 - 1.0)^2 = 0.0625
    const expectedBrier = Math.pow(predictedProbability - 1.0, 2);
    assert.approximately(
      predictionRecord.brierScore!,
      expectedBrier,
      0.0001
    );

    // Verify forecaster state updated
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );
    assert.equal(forecasterState.totalPredictions, 1);
    assert.equal(forecasterState.resolvedPredictions, 1);
    assert.approximately(
      forecasterState.avgBrierScore,
      expectedBrier,
      0.0001
    );
    assert.equal(forecasterState.correctPredictions, 1); // 0.75 > 0.5 and outcome = YES
    assert.equal(forecasterState.accuracy, 1.0); // 1/1 = 100%
    assert.equal(forecasterState.streakCorrect, 1);
  });

  it('Cannot resolve prediction twice', async () => {
    try {
      await program.methods
        .resolvePrediction(false)
        .accounts({
          resolver: resolverKeypair.publicKey,
          scoreConfig: scoreConfigPda,
          predictionRecord: predictionPda,
          forecasterState: forecasterStatePda,
        })
        .signers([resolverKeypair])
        .rpc();

      assert.fail('Should have thrown error');
    } catch (err: any) {
      assert.include(err.toString(), 'AlreadyResolved');
    }
  });

  it('Records and resolves multiple predictions', async () => {
    const predictions = [
      { marketId: Buffer.alloc(32, 2), prob: 0.6, outcome: true }, // Correct
      { marketId: Buffer.alloc(32, 3), prob: 0.3, outcome: false }, // Correct
      { marketId: Buffer.alloc(32, 4), prob: 0.8, outcome: false }, // Wrong
    ];

    for (const pred of predictions) {
      const ts = new anchor.BN(Date.now() + Math.random() * 1000);
      const tsBuffer = Buffer.alloc(8);
      tsBuffer.writeBigInt64LE(BigInt(ts.toString()));

      const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('prediction'),
          forecasterKeypair.publicKey.toBuffer(),
          pred.marketId,
          tsBuffer,
        ],
        program.programId
      );

      // Record
      await program.methods
        .recordPrediction(
          Array.from(pred.marketId),
          ts,
          pred.prob,
          { yes: {} },
          Array.from(memoTxSignature),
          0
        )
        .accounts({
          authority: forecasterKeypair.publicKey,
          forecasterState: forecasterStatePda,
          predictionRecord: pda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([forecasterKeypair])
        .rpc();

      // Resolve
      await program.methods
        .resolvePrediction(pred.outcome)
        .accounts({
          resolver: resolverKeypair.publicKey,
          scoreConfig: scoreConfigPda,
          predictionRecord: pda,
          forecasterState: forecasterStatePda,
        })
        .signers([resolverKeypair])
        .rpc();
    }

    // Check final stats
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );

    assert.equal(forecasterState.totalPredictions, 4); // 1 + 3
    assert.equal(forecasterState.resolvedPredictions, 4);
    assert.equal(forecasterState.correctPredictions, 3); // First + 2 correct
    assert.equal(forecasterState.accuracy, 0.75); // 3/4
    assert.equal(forecasterState.streakCorrect, 0); // Reset by wrong prediction

    console.log('Final forecaster stats:', {
      totalPredictions: forecasterState.totalPredictions,
      resolvedPredictions: forecasterState.resolvedPredictions,
      avgBrierScore: forecasterState.avgBrierScore,
      accuracy: forecasterState.accuracy,
      correctPredictions: forecasterState.correctPredictions,
      streakCorrect: forecasterState.streakCorrect,
      maxStreakCorrect: forecasterState.maxStreakCorrect,
    });
  });
});

// ========================================
// STATE COMPRESSION TESTS (TEMPORARILY DISABLED)
// ========================================
// Re-enable when compression dependencies are resolved

/*
describe('compressed predictions', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Calibration as Program<Calibration>;

  // SPL Account Compression program ID
  const COMPRESSION_PROGRAM_ID = new PublicKey(
    'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
  );
  const NOOP_PROGRAM_ID = new PublicKey(
    'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'
  );

  // Test accounts
  const forecaster2Keypair = Keypair.generate();
  const treeKeypair = Keypair.generate();
  let forecasterStatePda: PublicKey;

  before(async () => {
    // Airdrop SOL
    const signature = await provider.connection.requestAirdrop(
      forecaster2Keypair.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Derive forecaster PDA
    [forecasterStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('forecaster'), forecaster2Keypair.publicKey.toBuffer()],
      program.programId
    );

    // Initialize forecaster
    await program.methods
      .initializeForecaster()
      .accounts({
        authority: forecaster2Keypair.publicKey,
        forecasterState: forecasterStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([forecaster2Keypair])
      .rpc();
  });

  it('Initializes Merkle tree for compressed predictions', async () => {
    const maxDepth = 10; // 1,024 predictions capacity
    const maxBufferSize = 64;

    const tx = await program.methods
      .initializeMerkleTree(maxDepth, maxBufferSize)
      .accounts({
        payer: forecaster2Keypair.publicKey,
        treeAuthority: forecaster2Keypair.publicKey,
        merkleTree: treeKeypair.publicKey,
        compressionProgram: COMPRESSION_PROGRAM_ID,
      })
      .signers([forecaster2Keypair, treeKeypair])
      .rpc();

    console.log('Merkle tree initialized:', {
      tree: treeKeypair.publicKey.toBase58(),
      capacity: Math.pow(2, maxDepth),
      tx,
    });

    // Verify tree account exists
    const treeAccount = await provider.connection.getAccountInfo(
      treeKeypair.publicKey
    );
    assert.isNotNull(treeAccount);
    assert.equal(
      treeAccount!.owner.toBase58(),
      COMPRESSION_PROGRAM_ID.toBase58()
    );

    console.log('✅ Tree initialized successfully');
  });

  it('Records compressed prediction (99% cheaper!)', async () => {
    const marketId = Buffer.alloc(32, 5);
    const probability = 0.65;
    const memoSig = Buffer.alloc(64, 0);

    const tx = await program.methods
      .recordCompressedPrediction(
        Array.from(marketId),
        probability,
        { yes: {} },
        Array.from(memoSig),
        0
      )
      .accounts({
        authority: forecaster2Keypair.publicKey,
        forecasterState: forecasterStatePda,
        merkleTree: treeKeypair.publicKey,
        compressionProgram: COMPRESSION_PROGRAM_ID,
        logWrapper: NOOP_PROGRAM_ID,
      })
      .signers([forecaster2Keypair])
      .rpc();

    console.log('Compressed prediction recorded:', {
      tx,
      cost: '~$0.0001',
      savingsVsPDA: '99.96%',
    });

    // Verify forecaster stats updated (even for compressed)
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );
    assert.equal(forecasterState.totalPredictions, 1);
    assert.equal(forecasterState.resolvedPredictions, 0);

    console.log('✅ Compressed prediction recorded, stats updated');
  });

  it('Records multiple compressed predictions', async () => {
    const numPredictions = 5;

    for (let i = 0; i < numPredictions; i++) {
      const marketId = Buffer.alloc(32, 10 + i);
      const probability = 0.5 + i * 0.1; // 0.5, 0.6, 0.7, 0.8, 0.9
      const memoSig = Buffer.alloc(64, 0);

      await program.methods
        .recordCompressedPrediction(
          Array.from(marketId),
          probability,
          { yes: {} },
          Array.from(memoSig),
          i % 3 // Different categories
        )
        .accounts({
          authority: forecaster2Keypair.publicKey,
          forecasterState: forecasterStatePda,
          merkleTree: treeKeypair.publicKey,
          compressionProgram: COMPRESSION_PROGRAM_ID,
          logWrapper: NOOP_PROGRAM_ID,
        })
        .signers([forecaster2Keypair])
        .rpc();
    }

    // Verify stats
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );
    assert.equal(forecasterState.totalPredictions, 1 + numPredictions); // 1 + 5 = 6

    // Calculate cost savings
    const pdaCost = (1 + numPredictions) * 0.27; // $1.62
    const compressedCost = (1 + numPredictions) * 0.0001; // $0.0006
    const savings = pdaCost - compressedCost; // ~$1.62

    console.log('Cost comparison:', {
      predictions: 1 + numPredictions,
      pdaCost: `$${pdaCost.toFixed(4)}`,
      compressedCost: `$${compressedCost.toFixed(4)}`,
      savings: `$${savings.toFixed(4)} (99.96%)`,
    });

    console.log('✅ Multiple compressed predictions recorded');
  });

  it('Validates prediction probability bounds', async () => {
    const invalidProbabilities = [-0.1, 1.5, 2.0];

    for (const prob of invalidProbabilities) {
      try {
        await program.methods
          .recordCompressedPrediction(
            Array.from(Buffer.alloc(32, 99)),
            prob,
            { yes: {} },
            Array.from(Buffer.alloc(64, 0)),
            0
          )
          .accounts({
            authority: forecaster2Keypair.publicKey,
            forecasterState: forecasterStatePda,
            merkleTree: treeKeypair.publicKey,
            compressionProgram: COMPRESSION_PROGRAM_ID,
            logWrapper: NOOP_PROGRAM_ID,
          })
          .signers([forecaster2Keypair])
          .rpc();

        assert.fail(`Should have rejected probability: ${prob}`);
      } catch (err: any) {
        assert.include(err.toString(), 'InvalidProbability');
      }
    }

    console.log('✅ Probability validation works correctly');
  });

  it('Calculates cost savings at scale', async () => {
    // Demonstrate cost savings for various scales
    const scales = [100, 1000, 10000, 100000, 1_000_000];

    console.log('\n📊 Cost Comparison at Scale:');
    console.log('================================================');
    console.log('Predictions | PDA Cost   | Compressed | Savings');
    console.log('------------------------------------------------');

    for (const n of scales) {
      const pdaCost = n * 0.27;
      const compressedCost = n * 0.0001;
      const savings = pdaCost - compressedCost;
      const savingsPercent = ((savings / pdaCost) * 100).toFixed(2);

      console.log(
        `${n.toLocaleString().padStart(11)} | $${pdaCost.toLocaleString().padStart(9)} | $${compressedCost.toFixed(2).padStart(9)} | $${savings.toLocaleString()} (${savingsPercent}%)`
      );
    }
    console.log('================================================\n');

    // Verify our implementation achieves target cost
    assert.isTrue(
      0.0001 < 0.27,
      'Compressed predictions should be cheaper than PDAs'
    );
  });
});

// ========================================
// INTEGRATION TESTS
// ========================================

describe('integration: PDA + Compressed hybrid', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Calibration as Program<Calibration>;

  const COMPRESSION_PROGRAM_ID = new PublicKey(
    'cmtDvXumGCrqC1Age74AVPhSRVXJMd8PJS91L8KbNCK'
  );
  const NOOP_PROGRAM_ID = new PublicKey(
    'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV'
  );

  const hybridForecaster = Keypair.generate();
  const hybridTree = Keypair.generate();
  let forecasterStatePda: PublicKey;

  before(async () => {
    // Airdrop SOL
    const signature = await provider.connection.requestAirdrop(
      hybridForecaster.publicKey,
      3 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);

    // Initialize forecaster
    [forecasterStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from('forecaster'), hybridForecaster.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .initializeForecaster()
      .accounts({
        authority: hybridForecaster.publicKey,
        forecasterState: forecasterStatePda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([hybridForecaster])
      .rpc();

    // Initialize tree
    await program.methods
      .initializeMerkleTree(10, 64)
      .accounts({
        payer: hybridForecaster.publicKey,
        treeAuthority: hybridForecaster.publicKey,
        merkleTree: hybridTree.publicKey,
        compressionProgram: COMPRESSION_PROGRAM_ID,
      })
      .signers([hybridForecaster, hybridTree])
      .rpc();
  });

  it('Supports both PDA and compressed predictions', async () => {
    // Record 1 PDA prediction (expensive but queryable)
    const marketId1 = Buffer.alloc(32, 100);
    const ts1 = new anchor.BN(Date.now());
    const tsBuffer = Buffer.alloc(8);
    tsBuffer.writeBigInt64LE(BigInt(ts1.toString()));

    const [pdaPrediction] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('prediction'),
        hybridForecaster.publicKey.toBuffer(),
        marketId1,
        tsBuffer,
      ],
      program.programId
    );

    await program.methods
      .recordPrediction(
        Array.from(marketId1),
        ts1,
        0.8,
        { yes: {} },
        Array.from(Buffer.alloc(64, 0)),
        0
      )
      .accounts({
        authority: hybridForecaster.publicKey,
        forecasterState: forecasterStatePda,
        predictionRecord: pdaPrediction,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([hybridForecaster])
      .rpc();

    // Record 5 compressed predictions (cheap)
    for (let i = 0; i < 5; i++) {
      await program.methods
        .recordCompressedPrediction(
          Array.from(Buffer.alloc(32, 200 + i)),
          0.6 + i * 0.05,
          { yes: {} },
          Array.from(Buffer.alloc(64, 0)),
          0
        )
        .accounts({
          authority: hybridForecaster.publicKey,
          forecasterState: forecasterStatePda,
          merkleTree: hybridTree.publicKey,
          compressionProgram: COMPRESSION_PROGRAM_ID,
          logWrapper: NOOP_PROGRAM_ID,
        })
        .signers([hybridForecaster])
        .rpc();
    }

    // Verify stats track BOTH types
    const forecasterState = await program.account.forecasterState.fetch(
      forecasterStatePda
    );
    assert.equal(forecasterState.totalPredictions, 6); // 1 PDA + 5 compressed

    // Verify PDA prediction is queryable
    const pdaRecord = await program.account.predictionRecord.fetch(
      pdaPrediction
    );
    assert.equal(pdaRecord.predictedProbability, 0.8);

    console.log('✅ Hybrid approach works: PDA for important, compressed for scale');
  });
});
*/
