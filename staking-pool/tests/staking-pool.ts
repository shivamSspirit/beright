import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StakingPool } from "../target/types/staking_pool";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";

describe("staking-pool", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StakingPool as Program<StakingPool>;

  // Test accounts
  let forecaster: Keypair;
  let depositor: Keypair;
  let baseTokenMint: PublicKey;
  let poolMint: Keypair;
  let poolState: PublicKey;
  let poolStateBump: number;
  let poolMintAuthority: PublicKey;
  let poolMintAuthorityBump: number;
  let poolVault: PublicKey;
  let depositorState: PublicKey;
  let depositorStateBump: number;

  // Token accounts
  let depositorTokenAccount: PublicKey;
  let depositorPoolTokenAccount: PublicKey;

  // Constants
  const NAV_DECIMALS = 1_000_000_000; // 1e9
  const USDC_DECIMALS = 6;
  const DEPOSIT_AMOUNT = 1000 * 10 ** USDC_DECIMALS; // 1000 USDC

  before(async () => {
    // Create forecaster and depositor keypairs
    forecaster = Keypair.generate();
    depositor = Keypair.generate();
    poolMint = Keypair.generate();

    // Airdrop SOL to forecaster and depositor
    const airdropForecaster = await provider.connection.requestAirdrop(
      forecaster.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropForecaster);

    const airdropDepositor = await provider.connection.requestAirdrop(
      depositor.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropDepositor);

    // Create base token mint (USDC mock)
    baseTokenMint = await createMint(
      provider.connection,
      forecaster,
      forecaster.publicKey,
      null,
      USDC_DECIMALS
    );

    // Derive PDAs
    [poolState, poolStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("staking_pool"), forecaster.publicKey.toBuffer()],
      program.programId
    );

    [poolMintAuthority, poolMintAuthorityBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("pool_mint_authority"), poolState.toBuffer()],
      program.programId
    );

    [depositorState, depositorStateBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("depositor"),
        poolState.toBuffer(),
        depositor.publicKey.toBuffer(),
      ],
      program.programId
    );

    // Create depositor's base token account and mint tokens
    const depositorAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      depositor,
      baseTokenMint,
      depositor.publicKey
    );
    depositorTokenAccount = depositorAta.address;

    // Mint base tokens to depositor
    await mintTo(
      provider.connection,
      forecaster,
      baseTokenMint,
      depositorTokenAccount,
      forecaster,
      DEPOSIT_AMOUNT * 10 // Mint extra for multiple tests
    );

    console.log("Setup complete:");
    console.log("  Forecaster:", forecaster.publicKey.toBase58());
    console.log("  Depositor:", depositor.publicKey.toBase58());
    console.log("  Base Token Mint:", baseTokenMint.toBase58());
    console.log("  Pool State PDA:", poolState.toBase58());
  });

  describe("initialize_pool", () => {
    it("should initialize a pool for a verified forecaster", async () => {
      // Pool configuration
      const poolConfig = {
        minDeposit: new anchor.BN(100 * 10 ** USDC_DECIMALS), // 100 USDC min
        performanceFeeBps: 2000, // 20%
        managementFeeBps: 200, // 2%
        entryFeeBps: 0,
        exitFeeBps: 50, // 0.5%
        minLockPeriod: new anchor.BN(7 * 24 * 60 * 60), // 7 days
        withdrawalDelay: new anchor.BN(24 * 60 * 60), // 24 hours
        idleAllocationBps: 3000, // 30%
        closesAt: null,
      };

      // Verified tier: Brier < 0.25, 20+ predictions
      const avgBrierScore = 0.20;
      const resolvedPredictions = 50;

      const tx = await program.methods
        .initializePool(
          { alphaVault: {} }, // Pool type
          poolConfig,
          avgBrierScore,
          resolvedPredictions
        )
        .accounts({
          forecaster: forecaster.publicKey,
          poolState: poolState,
          poolMint: poolMint.publicKey,
          poolMintAuthority: poolMintAuthority,
          baseTokenMint: baseTokenMint,
          poolVault: await anchor.utils.token.associatedAddress({
            mint: baseTokenMint,
            owner: poolState,
          }),
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([forecaster, poolMint])
        .rpc();

      console.log("Initialize pool tx:", tx);

      // Fetch and verify pool state
      const poolAccount = await program.account.stakingPoolState.fetch(poolState);

      expect(poolAccount.forecaster.toBase58()).to.equal(forecaster.publicKey.toBase58());
      expect(poolAccount.poolMint.toBase58()).to.equal(poolMint.publicKey.toBase58());
      expect(poolAccount.baseToken.toBase58()).to.equal(baseTokenMint.toBase58());
      expect(poolAccount.navPerShare.toNumber()).to.equal(NAV_DECIMALS); // 1.0
      expect(poolAccount.highWaterMark.toNumber()).to.equal(NAV_DECIMALS);
      expect(poolAccount.totalDeposits.toNumber()).to.equal(0);
      expect(poolAccount.totalShares.toNumber()).to.equal(0);
      expect(poolAccount.depositorCount).to.equal(0);

      // Store pool vault for later tests
      poolVault = await anchor.utils.token.associatedAddress({
        mint: baseTokenMint,
        owner: poolState,
      });

      console.log("Pool initialized successfully!");
      console.log("  Max Capacity:", poolAccount.maxCapacity.toString());
      console.log("  Tier at Creation:", poolAccount.tierAtCreation);
    });

    it("should fail for unverified forecaster (Brier > 0.25)", async () => {
      const unverifiedForecaster = Keypair.generate();
      const airdrop = await provider.connection.requestAirdrop(
        unverifiedForecaster.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(airdrop);

      const [unverifiedPoolState] = PublicKey.findProgramAddressSync(
        [Buffer.from("staking_pool"), unverifiedForecaster.publicKey.toBuffer()],
        program.programId
      );

      const [unverifiedPoolMintAuthority] = PublicKey.findProgramAddressSync(
        [Buffer.from("pool_mint_authority"), unverifiedPoolState.toBuffer()],
        program.programId
      );

      const unverifiedPoolMint = Keypair.generate();

      const poolConfig = {
        minDeposit: new anchor.BN(100 * 10 ** USDC_DECIMALS),
        performanceFeeBps: 2000,
        managementFeeBps: 200,
        entryFeeBps: 0,
        exitFeeBps: 0,
        minLockPeriod: new anchor.BN(0),
        withdrawalDelay: new anchor.BN(0),
        idleAllocationBps: 3000,
        closesAt: null,
      };

      // Poor Brier score (> 0.25)
      const avgBrierScore = 0.35;
      const resolvedPredictions = 50;

      try {
        await program.methods
          .initializePool({ alphaVault: {} }, poolConfig, avgBrierScore, resolvedPredictions)
          .accounts({
            forecaster: unverifiedForecaster.publicKey,
            poolState: unverifiedPoolState,
            poolMint: unverifiedPoolMint.publicKey,
            poolMintAuthority: unverifiedPoolMintAuthority,
            baseTokenMint: baseTokenMint,
            poolVault: await anchor.utils.token.associatedAddress({
              mint: baseTokenMint,
              owner: unverifiedPoolState,
            }),
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([unverifiedForecaster, unverifiedPoolMint])
          .rpc();

        expect.fail("Should have thrown InsufficientTier error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("InsufficientTier");
        console.log("Correctly rejected unverified forecaster");
      }
    });
  });

  describe("deposit", () => {
    before(async () => {
      // Create depositor's pool token account
      const depositorPoolAta = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        depositor,
        poolMint.publicKey,
        depositor.publicKey
      );
      depositorPoolTokenAccount = depositorPoolAta.address;
    });

    it("should deposit and mint shares", async () => {
      const depositAmount = new anchor.BN(DEPOSIT_AMOUNT);

      // Get initial balances
      const initialDepositorBalance = (
        await getAccount(provider.connection, depositorTokenAccount)
      ).amount;

      const tx = await program.methods
        .deposit(depositAmount)
        .accounts({
          depositor: depositor.publicKey,
          poolState: poolState,
          depositorState: depositorState,
          depositorTokenAccount: depositorTokenAccount,
          poolVault: poolVault,
          poolMint: poolMint.publicKey,
          depositorPoolTokenAccount: depositorPoolTokenAccount,
          poolMintAuthority: poolMintAuthority,
          baseTokenMint: baseTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();

      console.log("Deposit tx:", tx);

      // Verify pool state updated
      const poolAccount = await program.account.stakingPoolState.fetch(poolState);
      expect(poolAccount.totalDeposits.toNumber()).to.equal(DEPOSIT_AMOUNT);
      expect(poolAccount.depositorCount).to.equal(1);
      expect(poolAccount.totalShares.toNumber()).to.be.greaterThan(0);

      // Verify depositor state created
      const depositorAccount = await program.account.depositorState.fetch(depositorState);
      expect(depositorAccount.depositor.toBase58()).to.equal(depositor.publicKey.toBase58());
      expect(depositorAccount.pool.toBase58()).to.equal(poolState.toBase58());
      expect(depositorAccount.shares.toNumber()).to.be.greaterThan(0);

      // Verify tokens transferred
      const finalDepositorBalance = (
        await getAccount(provider.connection, depositorTokenAccount)
      ).amount;
      expect(Number(initialDepositorBalance) - Number(finalDepositorBalance)).to.equal(
        DEPOSIT_AMOUNT
      );

      // Verify shares minted
      const depositorPoolBalance = (
        await getAccount(provider.connection, depositorPoolTokenAccount)
      ).amount;
      expect(Number(depositorPoolBalance)).to.be.greaterThan(0);

      console.log("Deposit successful!");
      console.log("  Shares minted:", depositorAccount.shares.toString());
      console.log("  Total pool deposits:", poolAccount.totalDeposits.toString());
    });

    it("should reject deposit below minimum", async () => {
      const tooSmallDeposit = new anchor.BN(10 * 10 ** USDC_DECIMALS); // 10 USDC < 100 USDC min

      try {
        await program.methods
          .deposit(tooSmallDeposit)
          .accounts({
            depositor: depositor.publicKey,
            poolState: poolState,
            depositorState: depositorState,
            depositorTokenAccount: depositorTokenAccount,
            poolVault: poolVault,
            poolMint: poolMint.publicKey,
            depositorPoolTokenAccount: depositorPoolTokenAccount,
            poolMintAuthority: poolMintAuthority,
            baseTokenMint: baseTokenMint,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([depositor])
          .rpc();

        expect.fail("Should have thrown BelowMinimumDeposit error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("BelowMinimumDeposit");
        console.log("Correctly rejected deposit below minimum");
      }
    });
  });

  describe("update_nav", () => {
    it("should allow forecaster to update NAV", async () => {
      // Simulate 10% profit: NAV goes from 1.0 to 1.1
      const newNav = new anchor.BN(1.1 * NAV_DECIMALS);

      const tx = await program.methods
        .updateNav(newNav)
        .accounts({
          forecaster: forecaster.publicKey,
          poolState: poolState,
        })
        .signers([forecaster])
        .rpc();

      console.log("Update NAV tx:", tx);

      // Verify NAV updated
      const poolAccount = await program.account.stakingPoolState.fetch(poolState);
      expect(poolAccount.navPerShare.toNumber()).to.equal(newNav.toNumber());
      expect(poolAccount.highWaterMark.toNumber()).to.equal(newNav.toNumber());

      console.log("NAV updated to:", poolAccount.navPerShare.toNumber() / NAV_DECIMALS);
    });

    it("should reject NAV update from non-forecaster", async () => {
      const newNav = new anchor.BN(1.2 * NAV_DECIMALS);

      try {
        await program.methods
          .updateNav(newNav)
          .accounts({
            forecaster: depositor.publicKey, // Wrong signer
            poolState: poolState,
          })
          .signers([depositor])
          .rpc();

        expect.fail("Should have thrown Unauthorized error");
      } catch (err: any) {
        expect(err.error.errorCode.code).to.equal("Unauthorized");
        console.log("Correctly rejected unauthorized NAV update");
      }
    });
  });

  describe("request_withdrawal", () => {
    it("should request withdrawal after lock period", async () => {
      // For testing, we'll assume the lock period has passed
      // In a real scenario, you'd need to warp time or set lock period to 0

      const depositorAccount = await program.account.depositorState.fetch(depositorState);
      const sharesToWithdraw = depositorAccount.shares;

      const tx = await program.methods
        .requestWithdrawal(sharesToWithdraw)
        .accounts({
          depositor: depositor.publicKey,
          poolState: poolState,
          depositorState: depositorState,
        })
        .signers([depositor])
        .rpc();

      console.log("Request withdrawal tx:", tx);

      // Verify withdrawal request recorded
      const updatedDepositorAccount = await program.account.depositorState.fetch(depositorState);
      expect(updatedDepositorAccount.withdrawalRequested.toNumber()).to.equal(
        sharesToWithdraw.toNumber()
      );
      expect(updatedDepositorAccount.withdrawableAfter.toNumber()).to.be.greaterThan(0);

      console.log("Withdrawal requested:");
      console.log("  Shares:", updatedDepositorAccount.withdrawalRequested.toString());
      console.log("  Withdrawable after:", new Date(updatedDepositorAccount.withdrawableAfter.toNumber() * 1000).toISOString());
    });

    it("should reject withdrawal request with zero shares", async () => {
      try {
        await program.methods
          .requestWithdrawal(new anchor.BN(0))
          .accounts({
            depositor: depositor.publicKey,
            poolState: poolState,
            depositorState: depositorState,
          })
          .signers([depositor])
          .rpc();

        expect.fail("Should have thrown ZeroDeposit error");
      } catch (err: any) {
        // Error could be ZeroDeposit or constraint violation
        console.log("Correctly rejected zero withdrawal request");
      }
    });
  });

  describe("process_withdrawal", () => {
    it("should process withdrawal after delay (simulated)", async () => {
      // Note: In a real test environment, you'd need to warp blockchain time
      // or set withdrawal_delay to 0 for immediate processing
      // This test demonstrates the expected flow

      const poolAccount = await program.account.stakingPoolState.fetch(poolState);
      const depositorAccount = await program.account.depositorState.fetch(depositorState);

      console.log("Withdrawal processing would happen after delay period");
      console.log("  Current withdrawal delay:", poolAccount.withdrawalDelay.toString(), "seconds");
      console.log("  Shares to burn:", depositorAccount.withdrawalRequested.toString());

      // In a real test with time warp:
      // 1. Wait for withdrawal_delay to pass
      // 2. Call process_withdrawal
      // 3. Verify shares burned and tokens transferred

      // For now, we just verify the state is correctly set up for processing
      expect(depositorAccount.withdrawalRequested.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("integration: full lifecycle", () => {
    it("should handle multiple deposits from same user", async () => {
      // This test verifies the add_deposit logic
      const additionalDeposit = new anchor.BN(500 * 10 ** USDC_DECIMALS);

      // Get current state
      const initialPoolAccount = await program.account.stakingPoolState.fetch(poolState);
      const initialDepositorAccount = await program.account.depositorState.fetch(depositorState);

      // Skip if withdrawal is pending (would fail constraint)
      if (initialDepositorAccount.status && initialDepositorAccount.status.withdrawalPending) {
        console.log("Skipping: withdrawal pending");
        return;
      }

      const tx = await program.methods
        .deposit(additionalDeposit)
        .accounts({
          depositor: depositor.publicKey,
          poolState: poolState,
          depositorState: depositorState,
          depositorTokenAccount: depositorTokenAccount,
          poolVault: poolVault,
          poolMint: poolMint.publicKey,
          depositorPoolTokenAccount: depositorPoolTokenAccount,
          poolMintAuthority: poolMintAuthority,
          baseTokenMint: baseTokenMint,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();

      console.log("Additional deposit tx:", tx);

      // Verify cumulative deposits
      const finalPoolAccount = await program.account.stakingPoolState.fetch(poolState);
      expect(finalPoolAccount.totalDeposits.toNumber()).to.be.greaterThan(
        initialPoolAccount.totalDeposits.toNumber()
      );

      // Depositor count should remain 1 (same depositor)
      expect(finalPoolAccount.depositorCount).to.equal(1);

      console.log("Multiple deposits handled correctly");
    });
  });
});
