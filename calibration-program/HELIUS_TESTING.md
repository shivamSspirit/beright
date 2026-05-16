# Helius Testing for Calibration Program

Complete guide for testing the BeRight calibration program on Solana devnet using Helius RPC.

---

## Quick Start

```bash
# 1. Install dependencies (if not already done)
cd calibration-program
npm install

# 2. Make sure HELIUS_API_KEY is in your .env
# Get your free key from: https://dev.helius.xyz

# 3. Run the test suite
npm run test:calibration
```

---

## What This Tests

The `test-helius.ts` script validates:

✅ **Helius RPC Connection** - Verifies you can connect to Solana devnet
✅ **Program Deployment** - Checks calibration program is on-chain
✅ **Forecaster Accounts** - Lists all forecasters who have made predictions
✅ **Prediction Records** - Shows prediction history and resolution status
✅ **Brier Score Calculations** - Validates accuracy tracking
✅ **Account Structure** - Parses and displays on-chain data correctly

---

## Available Commands

### Test Full Program State
```bash
npm run test:calibration
```

Shows:
- Total forecasters and predictions
- Top 5 forecasters by Brier score
- Resolved vs pending predictions
- Program deployment info

**Example Output:**
```
╔════════════════════════════════════════════════════════════╗
║    BeRight Calibration Program - Helius Test Suite        ║
╚════════════════════════════════════════════════════════════╝

🔌 Testing Helius RPC connection...

RPC URL: https://devnet.helius-rpc.com/?api-key=xxx

✓ Connected to Solana 1.18.22

Current slot: 328471562

📦 Testing calibration program deployment...

✓ Program deployed

Owner: BPFLoaderUpgradeab1e11111111111111111111111
Executable: true
Data length: 195840 bytes

📊 Fetching all program accounts...

✓ Found 42 total accounts

═══════════════════════════════════════════════════════════
                    CALIBRATION PROGRAM SUMMARY
═══════════════════════════════════════════════════════════

Program ID: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ
Network: Devnet

📊 Overall Stats:

  Total Forecasters: 8
  Total Predictions: 34
  Resolved Predictions: 12
  Pending Predictions: 22

🏆 Top Forecasters (by Brier Score):

  🥇 8XKv...3mN2
      Brier: 0.1847 | Predictions: 15 | Resolved: 8
  🥈 9jQp...7kLm
      Brier: 0.2103 | Predictions: 10 | Resolved: 4
  🥉 3Hfg...5xPq
      Brier: 0.2456 | Predictions: 6 | Resolved: 3

═══════════════════════════════════════════════════════════

✅ Test completed!

Explorer: https://explorer.solana.com/address/GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ?cluster=devnet
```

---

### Test Specific Forecaster

```bash
npm run test:calibration -- --forecaster <WALLET_ADDRESS>
```

**Example:**
```bash
npm run test:calibration -- --forecaster 8XKv3m2NxLRFP4TqQ7fJ5vC9dE2yH6wS3kN4pL7mN2
```

Shows:
- Forecaster account details
- Brier score and log score
- Total predictions made
- Recent prediction history with outcomes
- Performance rating (world-class, superforecaster, etc.)

**Example Output:**
```
🔍 Testing forecaster: 8XKv3m2NxLRFP4TqQ7fJ5vC9dE2yH6wS3kN4pL7mN2

Forecaster PDA: Fc7R3m9QxLKp2TfJ8vN5dE9yH2wS6kN1pL4mN5

✓ Forecaster account found

Owner: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ
Data length: 100 bytes
Lamports: 0.00203928 SOL

📈 Forecaster Stats:

  Authority: 8XKv3m2NxLRFP4TqQ7fJ5vC9dE2yH6wS3kN4pL7mN2
  Total Predictions: 15
  Resolved Predictions: 8
  Average Brier Score: 0.1847
  Average Log Score: -0.3251
  Account Created: 2026-04-08T15:32:41.000Z

⭐ SUPERFORECASTER level (Brier < 0.25)

🔎 Fetching prediction history...

Found 15 predictions

Recent Predictions:

1. Will Bitcoin reach $100K by end of 2026?
   Predicted: YES @ 68.0%
   Committed: 2026-04-14T10:22:15.000Z
   Outcome: YES | Brier: 0.1024

2. Fed rate cut by June 2026
   Predicted: YES @ 72.0%
   Committed: 2026-04-12T14:18:03.000Z
   Status: Pending resolution

3. Trump re-election 2028
   Predicted: NO @ 35.0%
   Committed: 2026-04-10T09:45:22.000Z
   Outcome: NO | Brier: 0.4225
```

---

## Understanding Brier Scores

**Brier Score** measures forecasting accuracy. Lower is better.

| Score | Rating |
|-------|--------|
| < 0.20 | 🏆 World-class forecaster |
| 0.20 - 0.25 | ⭐ Superforecaster level |
| 0.25 - 0.30 | ✓ Good forecaster |
| 0.30 - 0.40 | 📊 Developing |
| > 0.40 | ⚠️ Needs improvement |

**Formula**: `Brier = (predicted_probability - actual_outcome)^2`

**Example:**
- Predicted YES at 70% (0.7)
- Outcome: YES (1.0)
- Brier = (0.7 - 1.0)^2 = 0.09 ✓ Good prediction

---

## Troubleshooting

### ❌ "HELIUS_API_KEY not set"

```bash
# Add to .env in project root
HELIUS_API_KEY=your-key-here
HELIUS_RPC_DEVNET=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
```

Get your free API key: https://dev.helius.xyz

---

### ❌ "Program not found on devnet"

The calibration program might not be deployed yet.

**Deploy it:**
```bash
cd calibration-program
npm run deploy:devnet
```

**Verify deployment:**
```bash
solana program show GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ --url devnet
```

---

### ❌ "Connection failed"

Test your RPC manually:
```bash
curl https://api.devnet.solana.com \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

**With Helius:**
```bash
curl "https://devnet.helius-rpc.com/?api-key=YOUR_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

Expected response: `{"jsonrpc":"2.0","result":"ok","id":1}`

---

### ❌ "No forecasters found"

This means no one has made predictions yet.

**Test the calibration program:**
1. Connect Phantom wallet to devnet
2. Visit BeRight app at localhost:3000
3. Make a prediction on any market
4. Wait 10-30 seconds for confirmation
5. Run `npm run test:calibration` again

---

## How Predictions Are Stored

### Account Structure

**ForecasterState Account** (~100 bytes)
```
[Discriminator: 8 bytes]
[Authority: 32 bytes]
[Total Predictions: 8 bytes (u64)]
[Resolved Predictions: 8 bytes (u64)]
[Brier Score: 8 bytes (f64)]
[Log Score: 8 bytes (f64)]
[Created At: 8 bytes (i64)]
```

**Prediction Account** (~200 bytes)
```
[Discriminator: 8 bytes]
[Forecaster: 32 bytes]
[Market ID: 32 bytes]
[Predicted Probability: 8 bytes (f64)]
[Direction: 1 byte (enum: Yes=0, No=1)]
[Committed At: 8 bytes (i64)]
[Memo Tx Signature: 64 bytes]
[Category: 1 byte (u8)]
[Has Resolution: 1 byte (bool)]
[Resolved At: 8 bytes (i64)]
[Outcome: 1 byte (bool)]
[Brier Score: 8 bytes (f64)]
[Log Score: 8 bytes (f64)]
```

---

## Querying from Code

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { deriveForecasterPda, CALIBRATION_PROGRAM_ID } from './app/client';

const connection = new Connection('https://api.devnet.solana.com');
const forecasterPubkey = new PublicKey('YOUR_WALLET');

// Get forecaster account
const [forecasterPda] = deriveForecasterPda(forecasterPubkey);
const accountInfo = await connection.getAccountInfo(forecasterPda);

// Parse data
const data = accountInfo.data;
const totalPredictions = Number(data.readBigUInt64LE(40));
const brierScore = data.readDoubleLE(56);

console.log(`Predictions: ${totalPredictions}, Brier: ${brierScore.toFixed(4)}`);
```

---

## Advanced Usage

### Query All Predictions for a Market

```bash
npm run test:calibration -- --market "bitcoin-100k-2026"
```

(Feature not yet implemented - add to test-helius.ts if needed)

---

### Export Leaderboard Data

```bash
npm run test:calibration > leaderboard.txt
```

Parse the output for:
- Forecaster rankings
- Brier score distribution
- Prediction volume statistics

---

### Monitor Program in Real-Time

```bash
watch -n 5 'npm run test:calibration'
```

Refreshes every 5 seconds to show live updates.

---

## Integration with BeRight App

The calibration program is called automatically when users make predictions via:

1. **TradingModal** → Signs transaction
2. **usePredictionRecorder** → Calls `/api/v2/calibration`
3. **API builds transaction** → Includes init + record if needed
4. **User signs ONCE** → Single transaction to Solana
5. **Program stores on-chain** → Forecaster account + Prediction record
6. **Helius test validates** → Confirms data is correct

**View in BeRight:**
- Profile page: Shows your Brier score
- Leaderboard: Ranks forecasters
- Market detail: Shows prediction history

---

## Next Steps

After verifying your calibration program works:

1. ✅ **Test with real wallet** - Make predictions via BeRight UI
2. ✅ **Verify on Solana Explorer** - Check transactions confirmed
3. ✅ **Build calibration dashboard** - Frontend page to show Brier scores
4. ✅ **Enable mainnet** - Deploy program to production
5. ✅ **Add resolution flow** - Automatically resolve predictions when markets settle

---

## Resources

- **Helius Docs**: https://docs.helius.dev
- **Solana Explorer**: https://explorer.solana.com/?cluster=devnet
- **Calibration Program**: `GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ`
- **Brier Score**: https://en.wikipedia.org/wiki/Brier_score
- **Superforecasting**: Philip Tetlock's research on prediction accuracy

---

## Support

Issues? Questions?
1. Check troubleshooting section above
2. Verify `.env` has `HELIUS_API_KEY`
3. Test RPC manually with curl
4. Open issue on GitHub

---

**Last Updated**: April 2026
**Program Version**: v0.1.0
**Network**: Solana Devnet
