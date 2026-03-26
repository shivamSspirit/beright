<p align="center">
  <img src="../beright-logo.svg" alt="BeRight Logo" width="120" />
</p>

# BeRight Vault

Production-grade Solana vault program for the BeRight prediction market protocol.

**Stack:** Anchor 0.32.1 · Solana 2.3.0 · Rust stable 1.89+

---

## Security Features

| Feature | Description |
|---------|-------------|
| **Timelock** | Configurable withdrawal delay (0–30 days). Each withdrawal resets the clock. |
| **Epoch Rate Limiting** | Max lamports withdrawable per Solana epoch. Epoch counter resets automatically. |
| **Guardian Co-sign** | Large withdrawals (above threshold) require a second signer (cold wallet / hardware key). |
| **Emergency Freeze** | Owner or admin can freeze all deposits/withdrawals instantly. |
| **Rent-Exempt Floor** | Withdrawals that would drop vault below rent-exempt minimum are rejected. |
| **Checked Arithmetic** | All lamport math uses `checked_add`/`checked_sub` — silent overflow impossible. |
| **SPL Token Support** | Deposit/withdraw any SPL token (USDC, USDT, etc.) via ATA controlled by vault state PDA. |
| **Event Emission** | All operations emit on-chain events for real-time indexing. |
| **Reserved State Space** | 64 bytes reserved for future fields — no account realloc needed for v2. |

---

## Setup

### 1. Install Tools

```bash
# Install Rust (stable, 1.89+)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup update stable

# Install Solana CLI 2.3.0
sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"

# Install Anchor via AVM
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install 0.32.1
avm use 0.32.1

# Verify
anchor --version   # anchor-cli 0.32.1
solana --version   # solana-cli 2.3.0
```

### 2. Generate a local keypair

```bash
solana-keygen new -o ~/.config/solana/id.json
solana config set --url localhost
```

### 3. Install Node dependencies

```bash
yarn install
```

---

## Build

```bash
anchor build
```

The compiled program is at `target/deploy/beright_vault.so`.
The IDL is at `target/idl/beright_vault.json`.

**Update the program ID:**

```bash
anchor keys list
# Copy the program pubkey, then update:
# 1. declare_id!("...") in programs/beright-vault/src/lib.rs
# 2. [programs.localnet] beright_vault = "..." in Anchor.toml
anchor build   # rebuild with new ID
```

---

## Test

```bash
# Start local validator + run tests
anchor test

# Run against already-running validator
anchor test --skip-local-validator
```

Tests cover:
- Vault initialization (and double-init rejection)
- Deposit happy path + zero-amount rejection
- Withdrawal happy path + non-owner rejection + zero-amount rejection
- Epoch rate limiting (blocks over-limit withdrawals)
- Freeze/unfreeze (blocks deposits when frozen)
- Guardian setup + large-withdrawal co-sign requirement
- Timelock (30-day delay enforced)

---

## Deploy to Devnet

```bash
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

---

## Program Instructions

| Instruction | Auth | Description |
|-------------|------|-------------|
| `init_vault` | Owner (payer) | Initialize vault with security params |
| `deposit` | Anyone | Deposit SOL into vault |
| `withdraw` | Owner only | Withdraw SOL (timelock + rate limit + guardian check) |
| `deposit_token` | Anyone | Deposit any SPL token |
| `withdraw_token` | Owner only | Withdraw SPL tokens (timelock applies) |
| `freeze_vault` | Owner or admin | Emergency freeze |
| `unfreeze_vault` | Owner or admin | Remove freeze |
| `set_guardian` | Owner | Configure guardian pubkey + threshold |
| `remove_guardian` | Owner | Remove guardian requirement |

---

## VaultState Account Layout

```
Field                   Type        Size   Description
─────────────────────────────────────────────────────────────────────
discriminator           [u8;8]      8      Anchor auto
vault_bump              u8          1      Vault PDA bump
state_bump              u8          1      State PDA bump
owner                   Pubkey      32     Vault owner
total_deposited         u64         8      Lifetime deposits (lamports)
total_withdrawn         u64         8      Lifetime withdrawals (lamports)
is_frozen               bool        1      Freeze flag
version                 u8          1      Schema version (currently 1)
lock_until              i64         8      Unix timestamp unlock
withdrawal_delay        i64         8      Seconds to lock after each withdrawal
epoch_withdraw_limit    u64         8      Max lamports per epoch
current_epoch           u64         8      Epoch counter
epoch_withdrawn         u64         8      This epoch's running total
guardian                Pubkey      32     Co-signer for large withdrawals
large_withdraw_threshold u64        8      Lamport threshold for guardian
guardian_set            bool        1      Is a guardian configured?
_reserved               [u8;64]     64     Reserved for future fields
─────────────────────────────────────────────────────────────────────
Total                                205 bytes (256 allocated)
```

---

## TypeScript SDK

```typescript
import { VaultClient, sol, deriveVaultPda } from './app/client';
import { Connection, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idl from './target/idl/beright_vault.json';

const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const wallet = new anchor.Wallet(Keypair.fromSecretKey(/* your key */));
const client = new VaultClient(connection, wallet, idl);

// Initialize vault: 24h delay, 10 SOL/epoch limit
await client.initVault({
  withdrawalDelay: 86_400,
  epochWithdrawLimit: sol(10),
});

// Deposit
await client.deposit({ amount: sol(1) });

// Withdraw
await client.withdraw({ amount: sol(0.5) });

// Check state
const state = await client.fetchVaultState();
console.log('Balance:', await client.getVaultBalance());
console.log('Timelock:', await client.isTimelocked());
```

---

## Architecture Notes

- **Two PDAs per vault**: `[b"vault", owner]` holds SOL; `[b"vault_state", owner]` holds state. Separation keeps lamport accounting clean.
- **Token account authority**: `vault_state` PDA is the authority on all SPL token ATAs — allows CPI signing without a separate keypair.
- **Admin pubkey**: Hardcoded in `freeze.rs` as a program constant. Change before mainnet to a multisig.
- **No upgrade authority needed post-audit**: Once the program is verified and audited, consider making it immutable.
