# Devnet Deployment Guide

**Program**: BeRight Calibration Program
**Target**: Solana Devnet
**Status**: Ready to deploy (pending sufficient SOL)

---

## ✅ Wallet Configuration (COMPLETE)

**Your Wallet Address**: `BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi`

**Current Balance**: 2 SOL (on devnet)

**Required Balance**: ~2.5-3 SOL (for deployment + buffer)

**Keypair Location**: `~/.config/solana/id.json` ✅

**Anchor.toml Configuration**: ✅ Already configured
```toml
[provider]
cluster = "Localnet"  # We override this with --provider.cluster flag
wallet = "~/.config/solana/id.json"
```

---

## 💰 Get More Devnet SOL

You need **0.5-1 more SOL** to deploy. Here are your options:

### Option 1: Solana Web Faucet (Recommended)
1. Visit: https://faucet.solana.com
2. Select: **Devnet**
3. Paste your wallet: `BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi`
4. Request: 1-2 SOL
5. Wait for confirmation (~30 seconds)

### Option 2: QuickNode Faucet
1. Visit: https://faucet.quicknode.com/solana/devnet
2. Paste: `BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi`
3. Complete CAPTCHA
4. Request SOL

### Option 3: Sol Faucet (Discord Bot)
1. Join Solana Discord: https://discord.gg/solana
2. Go to `#faucet` channel
3. Type: `!faucet BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi`

### Option 4: CLI Airdrop (When Rate Limit Resets)
```bash
# Wait 1-2 hours, then try:
solana airdrop 2 --url https://api.devnet.solana.com

# Check balance:
solana balance --url https://api.devnet.solana.com
```

---

## 🚀 Deployment Commands

Once you have **3+ SOL**, run these commands:

### Step 1: Verify Balance
```bash
solana balance --url https://api.devnet.solana.com
# Should show 3+ SOL
```

### Step 2: Build Program
```bash
anchor build
```

### Step 3: Deploy to Devnet
```bash
anchor deploy --provider.cluster devnet
```

**Expected Output**:
```
Deploying cluster: https://api.devnet.solana.com
Upgrade authority: /Users/shivamsoni/.config/solana/id.json
Deploying program "calibration"...
Program path: .../target/deploy/calibration.so
Program Id: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ

Deploy success
```

### Step 4: Verify Deployment
```bash
# Check program exists on devnet
solana program show GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ \
  --url https://api.devnet.solana.com

# Expected output:
# Program Id: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ
# Owner: BPFLoaderUpgradeab1e11111111111111111111111
# ProgramData Address: <some address>
# Authority: BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi
# Last Deployed In Slot: <slot number>
# Data Length: <bytes>
```

---

## 📊 Deployment Cost Breakdown

**Estimated Costs** (on Devnet):
- Program deployment: ~2.0-2.2 SOL (rent-exempt minimum)
- Transaction fees: ~0.01 SOL
- IDL upload: ~0.01 SOL
- **Total**: ~2.2-2.5 SOL

**Your Current Balance**: 2 SOL ❌ (need 0.5 more)

**After Getting More SOL**: 3-4 SOL ✅ (sufficient with buffer)

---

## 🧪 Test on Devnet

After deployment, you can test the program:

### Initialize Forecaster
```bash
anchor run initialize-forecaster --provider.cluster devnet
```

### Record Prediction
```typescript
// In tests/calibration.ts, update connection:
const connection = new anchor.web3.Connection(
  'https://api.devnet.solana.com',
  'confirmed'
);

// Run test:
anchor test --skip-deploy --provider.cluster devnet
```

---

## 🔗 Devnet Explorer Links

Once deployed, view your program on Solana explorers:

**Solscan (Devnet)**:
```
https://solscan.io/account/GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ?cluster=devnet
```

**Solana Explorer**:
```
https://explorer.solana.com/address/GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ?cluster=devnet
```

**Anchor Registry** (if published):
```
https://www.apr.dev/program/GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ
```

---

## 🎯 Deployment Checklist

- [x] Wallet created and funded with 2 SOL
- [x] Anchor.toml configured with wallet path
- [x] Program built successfully
- [x] Program ID synced across all files
- [ ] **Need 1 more SOL** (pending faucet request)
- [ ] Deploy to devnet
- [ ] Verify deployment on explorer
- [ ] Test basic functionality (initialize, record, resolve)
- [ ] Share devnet link for public testing

---

## ⚠️ Important Notes

### Program Upgrades
Your wallet (`BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi`) is the **upgrade authority**.

This means:
- ✅ You can upgrade the program later with `anchor upgrade`
- ✅ You can close the program and recover rent
- ⚠️ Keep your keypair safe! Anyone with it can upgrade/close the program

### Upgrade Command (For Future Updates)
```bash
# After making code changes:
anchor build
anchor upgrade target/deploy/calibration.so \
  --program-id GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ \
  --provider.cluster devnet
```

### Close Program (Recover Rent)
```bash
# Only use if you want to delete the program and get SOL back:
solana program close GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ \
  --url https://api.devnet.solana.com
```

---

## 🐛 Troubleshooting

### Error: Insufficient Funds
```
Error: Account has insufficient funds for spend (2.20 SOL) + fee (0.00167 SOL)
```
**Solution**: Get more SOL from faucet (see options above)

### Error: Rate Limit Reached
```
Error: airdrop request failed. This can happen when the rate limit is reached.
```
**Solution**:
1. Wait 1-2 hours and try CLI airdrop again
2. OR use web faucet (different rate limit)
3. OR use Discord bot

### Error: Program Already Deployed
```
Error: Account already exists
```
**Solution**: Use `anchor upgrade` instead of `anchor deploy`

### Error: Wrong Cluster
```
Error: Cannot find program
```
**Solution**: Make sure you're using `--provider.cluster devnet` flag

---

## 📝 Next Steps After Deployment

1. **Test the Program**
   - Initialize forecaster account
   - Record test predictions
   - Resolve predictions
   - Verify Brier score calculations

2. **Share with Community**
   - Post on Solana Discord
   - Tweet the explorer link
   - Get feedback from users

3. **Integrate with BeRight Bot**
   - Update connection to devnet
   - Start recording bot predictions on-chain
   - Build public track record

4. **Prepare for Mainnet**
   - Get security audit (recommended)
   - Test thoroughly on devnet (100+ predictions)
   - Calculate mainnet deployment costs (~$20-30 in SOL)

---

## 💡 Quick Reference

**Wallet**: `BaQhHZ6gA49DSBeJ7PGbw3vJsVTUMpVfT2U79mHKWyWi`

**Program ID**: `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ`

**Devnet RPC**: `https://api.devnet.solana.com`

**Deploy Command**: `anchor deploy --provider.cluster devnet`

**Upgrade Command**: `anchor upgrade target/deploy/calibration.so --program-id GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ --provider.cluster devnet`

**Check Balance**: `solana balance --url https://api.devnet.solana.com`

**View Program**: `solana program show GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ --url https://api.devnet.solana.com`

---

**Last Updated**: March 5, 2026
**Status**: Waiting for SOL funding (2/3 SOL obtained)
