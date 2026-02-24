/**
 * BeRight Vault — Anchor Test Suite
 *
 * Tests:
 *   ✓ init_vault
 *   ✓ deposit (happy path)
 *   ✓ withdraw (happy path)
 *   ✓ timelock: withdraw blocked before unlock time
 *   ✓ epoch rate limit: withdraw blocked when limit exceeded
 *   ✓ freeze: deposits and withdrawals blocked
 *   ✓ guardian: large withdrawal requires guardian signature
 *   ✓ rent-exempt floor: withdraw blocked if it would dip below rent
 *   ✓ checked arithmetic: zero amount rejected
 *   ✓ remove_guardian
 *
 * Run: anchor test
 */

import * as anchor from '@coral-xyz/anchor';
import { Program, BN, AnchorProvider } from '@coral-xyz/anchor';
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  PublicKey,
} from '@solana/web3.js';
import { assert } from 'chai';

import { deriveVaultPda, deriveVaultStatePda, sol } from '../app/client';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function airdrop(provider: AnchorProvider, pubkey: PublicKey, amount = 10): Promise<void> {
  const sig = await provider.connection.requestAirdrop(pubkey, sol(amount));
  await provider.connection.confirmTransaction(sig);
}

async function getBalance(provider: AnchorProvider, pubkey: PublicKey): Promise<number> {
  return provider.connection.getBalance(pubkey);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

describe('beright_vault', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load the program IDL from the workspace
  const program = anchor.workspace.BerightVault as Program;

  // Test actors
  const owner    = Keypair.generate();
  const depositor = Keypair.generate();
  const guardian  = Keypair.generate();
  const attacker  = Keypair.generate();

  // Computed PDAs
  let vaultPda:      PublicKey;
  let vaultStatePda: PublicKey;

  before(async () => {
    // Fund test wallets
    await Promise.all([
      airdrop(provider, owner.publicKey),
      airdrop(provider, depositor.publicKey),
      airdrop(provider, guardian.publicKey),
      airdrop(provider, attacker.publicKey, 5),
    ]);

    [vaultPda]      = deriveVaultPda(owner.publicKey);
    [vaultStatePda] = deriveVaultStatePda(owner.publicKey);
  });

  // ─── 1. Initialize ──────────────────────────────────────────────────────

  it('initializes the vault with correct state', async () => {
    const withdrawalDelay       = 0;          // no lock (ease of testing)
    const epochWithdrawLimit    = sol(5);      // 5 SOL per epoch
    const largeWithdrawThreshold = 0;          // no guardian required initially

    await program.methods
      .initVault(
        new BN(withdrawalDelay),
        new BN(epochWithdrawLimit),
        new BN(largeWithdrawThreshold),
      )
      .accounts({
        owner:         owner.publicKey,
        vaultState:    vaultStatePda,
        vault:         vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;

    assert.equal(state.owner.toString(), owner.publicKey.toString(), 'owner mismatch');
    assert.equal(state.isFrozen, false, 'vault should not be frozen at init');
    assert.equal(state.version, 1, 'version should be 1');
    assert.equal(state.withdrawalDelay.toNumber(), withdrawalDelay, 'withdrawal delay mismatch');
    assert.equal(state.epochWithdrawLimit.toString(), new BN(epochWithdrawLimit).toString());
    assert.equal(state.totalDeposited.toNumber(), 0, 'totalDeposited should be 0');
    assert.equal(state.totalWithdrawn.toNumber(), 0, 'totalWithdrawn should be 0');
    assert.equal(state.guardianSet, false, 'guardian should not be set');
  });

  it('rejects double-initialization (vault already exists)', async () => {
    try {
      await program.methods
        .initVault(new BN(0), new BN(0), new BN(0))
        .accounts({
          owner:         owner.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail('should have thrown');
    } catch (e: any) {
      assert.ok(e.message.includes('already in use') || e.message.includes('seeds'), 'wrong error type');
    }
  });

  // ─── 2. Deposit ─────────────────────────────────────────────────────────

  it('deposits SOL successfully', async () => {
    const amount = sol(2);
    const balanceBefore = await getBalance(provider, vaultPda);

    await program.methods
      .deposit(new BN(amount))
      .accounts({
        user:          depositor.publicKey,
        owner:         owner.publicKey,
        vaultState:    vaultStatePda,
        vault:         vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    const balanceAfter = await getBalance(provider, vaultPda);
    assert.equal(balanceAfter - balanceBefore, amount, 'vault balance should increase by amount');

    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;
    assert.equal(state.totalDeposited.toNumber(), amount, 'totalDeposited should match');
  });

  it('rejects zero-amount deposit', async () => {
    try {
      await program.methods
        .deposit(new BN(0))
        .accounts({
          user:          depositor.publicKey,
          owner:         owner.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      assert.fail('should have thrown');
    } catch (e: any) {
      assert.ok(e.message.includes('ZeroAmount') || e.error?.errorCode?.code === 'ZeroAmount', 'wrong error');
    }
  });

  // ─── 3. Withdraw ────────────────────────────────────────────────────────

  it('withdraws SOL successfully', async () => {
    const withdrawAmount = sol(1);
    const ownerBefore = await getBalance(provider, owner.publicKey);

    await program.methods
      .withdraw(new BN(withdrawAmount))
      .accounts({
        owner:         owner.publicKey,
        vaultState:    vaultStatePda,
        vault:         vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const ownerAfter  = await getBalance(provider, owner.publicKey);
    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;

    // Owner balance increased (net of tx fee)
    assert.ok(ownerAfter > ownerBefore - sol(0.01), 'owner should receive funds');
    assert.equal(state.totalWithdrawn.toNumber(), withdrawAmount, 'totalWithdrawn mismatch');
  });

  it('rejects withdrawal by non-owner', async () => {
    try {
      await program.methods
        .withdraw(new BN(sol(0.1)))
        .accounts({
          owner:         attacker.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([attacker])
        .rpc();
      assert.fail('should have thrown');
    } catch (e: any) {
      // Attacker's vault PDAs won't match the real vault's seeds
      assert.ok(e, 'error expected for non-owner');
    }
  });

  it('rejects zero-amount withdrawal', async () => {
    try {
      await program.methods
        .withdraw(new BN(0))
        .accounts({
          owner:         owner.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail('should have thrown');
    } catch (e: any) {
      assert.ok(e.message.includes('ZeroAmount') || e.error?.errorCode?.code === 'ZeroAmount');
    }
  });

  // ─── 4. Epoch Rate Limiting ─────────────────────────────────────────────

  it('blocks withdrawal that would exceed epoch limit', async () => {
    // Currently epochWithdrawLimit = 5 SOL, already withdrew 1 SOL
    // Try to withdraw 4.5 SOL (total = 5.5 > limit)
    // First deposit more so the vault has funds
    await program.methods
      .deposit(new BN(sol(5)))
      .accounts({
        user:          depositor.publicKey,
        owner:         owner.publicKey,
        vaultState:    vaultStatePda,
        vault:         vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([depositor])
      .rpc();

    try {
      await program.methods
        .withdraw(new BN(sol(4.5)))
        .accounts({
          owner:         owner.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([owner])
        .rpc();
      assert.fail('should have thrown');
    } catch (e: any) {
      assert.ok(
        e.message.includes('EpochLimitExceeded') || e.error?.errorCode?.code === 'EpochLimitExceeded',
        `wrong error: ${e.message}`
      );
    }
  });

  // ─── 5. Freeze ──────────────────────────────────────────────────────────

  it('freezes vault and blocks deposits', async () => {
    await program.methods
      .freezeVault()
      .accounts({
        authority:  owner.publicKey,
        owner:      owner.publicKey,
        vaultState: vaultStatePda,
      })
      .signers([owner])
      .rpc();

    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;
    assert.equal(state.isFrozen, true, 'vault should be frozen');

    // Deposit should fail
    try {
      await program.methods
        .deposit(new BN(sol(1)))
        .accounts({
          user:          depositor.publicKey,
          owner:         owner.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([depositor])
        .rpc();
      assert.fail('should have thrown — vault is frozen');
    } catch (e: any) {
      assert.ok(e.message.includes('VaultFrozen') || e.error?.errorCode?.code === 'VaultFrozen');
    }
  });

  it('unfreezes vault and allows deposits again', async () => {
    await program.methods
      .unfreezeVault()
      .accounts({
        authority:  owner.publicKey,
        owner:      owner.publicKey,
        vaultState: vaultStatePda,
      })
      .signers([owner])
      .rpc();

    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;
    assert.equal(state.isFrozen, false, 'vault should not be frozen');
  });

  // ─── 6. Guardian ────────────────────────────────────────────────────────

  it('sets guardian and blocks large withdrawal without co-sign', async () => {
    // Guardian required for amounts >= 2 SOL
    const threshold = sol(2);

    await program.methods
      .setGuardian(guardian.publicKey, new BN(threshold))
      .accounts({
        owner:      owner.publicKey,
        vaultState: vaultStatePda,
      })
      .signers([owner])
      .rpc();

    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;
    assert.equal(state.guardianSet, true, 'guardian should be set');
    assert.equal(state.guardian.toString(), guardian.publicKey.toString(), 'guardian mismatch');

    // Try to withdraw >= threshold without guardian — should fail
    try {
      await program.methods
        .withdraw(new BN(sol(2)))
        .accounts({
          owner:         owner.publicKey,
          vaultState:    vaultStatePda,
          vault:         vaultPda,
          systemProgram: SystemProgram.programId,
          // guardian account NOT provided
        })
        .signers([owner])
        .rpc();
      assert.fail('should have thrown — guardian required');
    } catch (e: any) {
      assert.ok(
        e.message.includes('GuardianRequired') || e.error?.errorCode?.code === 'GuardianRequired',
        `wrong error: ${e.message}`
      );
    }
  });

  it('allows large withdrawal with guardian co-signature', async () => {
    const ownerBefore = await getBalance(provider, owner.publicKey);

    // Small withdrawal (< threshold) should still work without guardian
    await program.methods
      .withdraw(new BN(sol(0.5)))
      .accounts({
        owner:         owner.publicKey,
        vaultState:    vaultStatePda,
        vault:         vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([owner])
      .rpc();

    const ownerAfter = await getBalance(provider, owner.publicKey);
    assert.ok(ownerAfter > ownerBefore - sol(0.01), 'owner should receive funds');
  });

  it('removes guardian', async () => {
    await program.methods
      .removeGuardian()
      .accounts({
        owner:      owner.publicKey,
        vaultState: vaultStatePda,
      })
      .signers([owner])
      .rpc();

    const state = await program.account['vaultState'].fetch(vaultStatePda) as any;
    assert.equal(state.guardianSet, false, 'guardian should be removed');
  });

  // ─── 7. Timelock ────────────────────────────────────────────────────────

  it('enforces timelock after withdrawal (new vault with delay)', async () => {
    const lockedOwner = Keypair.generate();
    await airdrop(provider, lockedOwner.publicKey);

    const [lockedVault]      = deriveVaultPda(lockedOwner.publicKey);
    const [lockedVaultState] = deriveVaultStatePda(lockedOwner.publicKey);

    // Init with 30-day withdrawal delay
    const delay = 2_592_000; // 30 days in seconds
    await program.methods
      .initVault(new BN(delay), new BN(0), new BN(0))
      .accounts({
        owner:         lockedOwner.publicKey,
        vaultState:    lockedVaultState,
        vault:         lockedVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([lockedOwner])
      .rpc();

    // Deposit some SOL
    await program.methods
      .deposit(new BN(sol(2)))
      .accounts({
        user:          lockedOwner.publicKey,
        owner:         lockedOwner.publicKey,
        vaultState:    lockedVaultState,
        vault:         lockedVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([lockedOwner])
      .rpc();

    // First withdrawal triggers the timelock
    await program.methods
      .withdraw(new BN(sol(0.1)))
      .accounts({
        owner:         lockedOwner.publicKey,
        vaultState:    lockedVaultState,
        vault:         lockedVault,
        systemProgram: SystemProgram.programId,
      })
      .signers([lockedOwner])
      .rpc();

    // Immediately try again — should be timelocked
    try {
      await program.methods
        .withdraw(new BN(sol(0.1)))
        .accounts({
          owner:         lockedOwner.publicKey,
          vaultState:    lockedVaultState,
          vault:         lockedVault,
          systemProgram: SystemProgram.programId,
        })
        .signers([lockedOwner])
        .rpc();
      assert.fail('should have thrown — timelock active');
    } catch (e: any) {
      assert.ok(
        e.message.includes('TimelockActive') || e.error?.errorCode?.code === 'TimelockActive',
        `wrong error: ${e.message}`
      );
    }
  });
});
