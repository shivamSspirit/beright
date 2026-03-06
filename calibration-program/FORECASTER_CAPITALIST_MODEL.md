# Forecaster-Capitalist Economic Model

## 🎯 The Core Problem This Solves

### For Forecasters (Skilled Predictors)
**Problem**: "I can predict markets accurately but don't have capital to profit from my skill"
- Strong track record on Polymarket/Kalshi but can't scale
- Risk-averse or capital-constrained
- Track record exists on centralized platforms (not portable, not verifiable)

### For Capitalists (Capital Providers)
**Problem**: "I have capital but don't have time/skill to research prediction markets"
- Want exposure to prediction market alpha
- Don't want to learn every market
- Need to verify forecaster skill before committing capital

---

## ✅ Current Implementation: On-Chain Calibration Tracking

### What's Live Right Now

The Anchor program provides **immutable, verifiable proof of forecasting skill** through:

#### 1. ForecasterState (Your On-Chain Resume)
```rust
pub struct ForecasterState {
    // PRIMARY METRICS (What Capitalists Look At)
    pub avg_brier_score: f64,        // 0.0 = perfect, 0.25 = baseline
    pub accuracy: f64,                // 75% = good, 80%+ = excellent
    pub total_predictions: u32,       // Sample size matters!
    pub resolved_predictions: u32,

    // CALIBRATION PROOF (Are you actually skilled or just lucky?)
    pub calibration_buckets: [[u16; 2]; 10],  // Predicted vs Actual

    // TRACK RECORD INDICATORS
    pub streak_correct: u16,          // Current hot streak
    pub max_streak_correct: u16,      // Best streak ever
    pub best_category: u8,            // Your edge (crypto? politics?)
    pub worst_category: u8,           // Where to avoid

    // TIMESTAMP PROOFS
    pub created_at: i64,              // When did you start?
    pub last_prediction_ts: i64,      // Are you still active?
}
```

#### 2. PredictionRecord (Individual Predictions)
```rust
pub struct PredictionRecord {
    pub market_id: [u8; 32],           // Which market?
    pub predicted_probability: f64,    // What did you predict?
    pub committed_at: i64,             // BEFORE the outcome (no cheating)
    pub memo_tx_signature: [u8; 64],   // Immutable proof via Memo program
    pub outcome: Option<bool>,         // What actually happened?
    pub brier_score: Option<f64>,      // How accurate were you?
}
```

### How Forecasters Use It (TODAY)

**Step 1: Initialize Your Track Record**
```bash
# Create your on-chain calibration account (one-time, ~$0.40)
anchor run initialize-forecaster
```

**Step 2: Commit Predictions**
```typescript
// BEFORE the event resolves, commit your prediction on-chain
await program.methods.recordPrediction(
  marketId,              // "Bitcoin above $100k by Dec 31?"
  timestamp,             // Current time
  0.75,                  // 75% probability YES
  { yes: {} },           // Direction
  memoSignature,         // Immutable commitment (Memo program)
  5                      // Category: crypto
).rpc();
```

**Step 3: Resolve After Outcome Known**
```typescript
// After Dec 31, resolve with actual outcome
await program.methods.resolvePrediction(
  true  // Bitcoin DID go above $100k
).rpc();

// Brier score automatically calculated: (0.75 - 1.0)² = 0.0625
// Your avg_brier_score updates: 0.238 (excellent!)
```

**Step 4: Share Your On-Chain Proof**
```
"Check my track record: GDMJpNckYfRCKbsC1m1qRx1x4jbtKGhdAHRLbQqrihPZ"

Forecaster: shivam.sol
Avg Brier Score: 0.238 ⭐⭐⭐⭐⭐
Accuracy: 75% (3/4 correct)
Sample Size: 4 predictions
Calibration: Well-calibrated (see curve)
Best Category: Crypto markets
```

---

## 🔮 Future Implementation: Forecaster-Capitalist Middleware

### What's NOT Yet Built (But Architecturally Designed)

The middleware connects skilled forecasters with capital providers through **stake-based profit sharing**.

### Economic Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   FORECASTER-CAPITALIST LOOP                 │
└─────────────────────────────────────────────────────────────┘

1. FORECASTER BUILDS REPUTATION
   │
   ├─► Records 100+ predictions on-chain
   ├─► Avg Brier Score: 0.22 (top 10%)
   ├─► Calibration curve: well-calibrated
   └─► Best category: Crypto markets

2. FORECASTER MINTS ACCURACY NFT
   │
   ├─► NFT metadata: avg_brier_score, sample_size, calibration
   ├─► Listed on marketplace: "Stake on my predictions"
   └─► Set profit share: 20% to stakers, 80% to forecaster

3. CAPITALIST DISCOVERS NFT
   │
   ├─► Filters: Brier < 0.25, sample > 50, category = crypto
   ├─► Reviews calibration curve (not just lucky!)
   └─► Decides: "This forecaster has real edge"

4. CAPITALIST STAKES CAPITAL
   │
   ├─► Stakes 10 SOL on forecaster's NFT
   ├─► Auto-copy their trades on prediction markets
   └─► Profit share: Forecaster 80%, Capitalist 20%

5. FORECASTER MAKES NEW PREDICTION
   │
   ├─► Records: "Bitcoin $120k by Q2" (80% confidence)
   ├─► Middleware auto-executes for staked capital:
   │   ├─► Buys YES shares on Polymarket (from capitalist's 10 SOL)
   │   └─► Position size: Kelly criterion based on edge

6. MARKET RESOLVES
   │
   ├─► Bitcoin hits $120k ✅
   ├─► Position profit: 2 SOL
   └─► Distribution:
       ├─► Forecaster: 1.6 SOL (80%)
       └─► Capitalist: 0.4 SOL (20%)

7. REPUTATION COMPOUNDS
   │
   ├─► Brier score improves: 0.22 → 0.21
   ├─► More capitalists stake (network effect)
   └─► Forecaster scales without own capital
```

---

## 🏗️ Technical Architecture (Future Implementation)

### New Anchor Instructions Needed

```rust
// 1. Mint Accuracy NFT
pub fn mint_accuracy_nft(
    ctx: Context<MintAccuracyNFT>,
    profit_share_bps: u16,  // Basis points to stakers (e.g., 2000 = 20%)
) -> Result<()>

// 2. Stake on Forecaster
pub fn stake_capital(
    ctx: Context<StakeCapital>,
    forecaster_nft: Pubkey,
    amount: u64,
) -> Result<()>

// 3. Auto-Execute Trade (Copy Trading)
pub fn execute_prediction_trade(
    ctx: Context<ExecuteTrade>,
    prediction: Pubkey,
    market_address: Pubkey,  // Polymarket/Kalshi market
) -> Result<()>

// 4. Distribute Profits
pub fn distribute_profits(
    ctx: Context<DistributeProfits>,
    prediction: Pubkey,
) -> Result<()>
```

### New Account Types Needed

```rust
/// NFT representing forecaster's track record
#[account]
pub struct AccuracyNFT {
    pub forecaster: Pubkey,
    pub forecaster_state: Pubkey,  // Link to calibration data
    pub profit_share_bps: u16,      // e.g., 2000 = 20% to stakers
    pub total_staked: u64,          // SOL staked by capitalists
    pub is_active: bool,
}

/// Capitalist's stake on a forecaster
#[account]
pub struct StakePosition {
    pub capitalist: Pubkey,
    pub accuracy_nft: Pubkey,
    pub amount_staked: u64,
    pub profits_earned: i64,        // Can be negative!
    pub staked_at: i64,
}

/// Trade executed on behalf of stakers
#[account]
pub struct CopyTrade {
    pub prediction_record: Pubkey,
    pub market_address: Pubkey,
    pub total_capital_deployed: u64,
    pub profit_loss: i64,
    pub resolved: bool,
}
```

---

## 💰 Economic Value Proposition

### For Forecasters

| Without Calibration Program | With Calibration Program |
|---------------------------|------------------------|
| ❌ Can't prove skill to investors | ✅ On-chain verifiable track record |
| ❌ Need own capital to profit | ✅ Access to pooled capital from stakers |
| ❌ Track record on centralized platforms | ✅ Portable, immutable Solana account |
| ❌ Limited by personal bankroll | ✅ Scale infinitely with staker capital |
| ❌ 100% of losses = personal risk | ✅ Performance fees (20-30%) with no downside |
| **Max Earnings**: Limited by capital | **Max Earnings**: UNLIMITED based on skill |

**Example**:
- Forecaster with 0.22 Brier score (top 10%)
- Attracts $100k in staked capital
- 10% annual return on predictions
- **Earnings**: $10k profit × 80% share = **$8k/year** with ZERO capital risk

### For Capitalists

| Traditional Prediction Markets | With Forecaster Staking |
|------------------------------|----------------------|
| ❌ Must research every market | ✅ Delegate to proven experts |
| ❌ No skill verification | ✅ On-chain Brier scores + calibration |
| ❌ Time-intensive | ✅ Passive income (auto-copy trades) |
| ❌ Can't diversify across forecasters | ✅ Stake across multiple forecasters |
| ❌ No downside protection | ✅ Can unstake anytime |
| **Risk**: High (no expertise) | **Risk**: Lower (proven track records) |

**Example**:
- Capitalist stakes 10 SOL across 5 top forecasters
- Diversified across crypto, politics, sports categories
- Avg forecaster Brier: 0.23 (top 15%)
- **Returns**: 15% annual yield with verified skill backing

---

## 📊 Key Metrics That Drive Value

### For Forecasters (What You Want to Optimize)

1. **Brier Score < 0.25** (Baseline is 0.25 for random guessing)
   - 0.20-0.25: Good (top 30%)
   - 0.15-0.20: Excellent (top 10%)
   - < 0.15: Elite (top 1%)

2. **Sample Size > 50** (Minimum credibility)
   - < 20 predictions: Not enough data
   - 50-100: Credible track record
   - 100+: Strong confidence

3. **Calibration Curve** (Proof you're not just lucky)
   - When you say 70%, does it happen 70% of the time?
   - Perfect calibration = predicted % matches actual %
   - Overconfident = bad (predicted 90%, happens 60%)
   - Underconfident = bad (predicted 60%, happens 90%)

4. **Category Specialization**
   - Generalist: 0.25 Brier across all categories
   - Specialist: 0.18 Brier in crypto, 0.30 in politics
   - **Focus on your edge!**

### For Capitalists (What You Filter By)

**Minimum Requirements**:
- Brier Score < 0.25
- Sample Size > 50
- Active (prediction in last 30 days)
- Well-calibrated (calibration curve R² > 0.8)

**Bonus Signals**:
- Long streak (10+ correct)
- Specialization in your preferred category
- High profit share offered (20%+)
- Long track record (6+ months)

---

## 🎮 Real-World Use Cases

### Use Case 1: Crypto Prediction Specialist

**Forecaster Profile**:
```
Wallet: alice.sol
Avg Brier: 0.19
Sample: 87 predictions
Best Category: Crypto (0.16 Brier)
Worst Category: Politics (0.34 Brier)
```

**Strategy**:
- Only predicts crypto markets (BTC price, ETH merge, etc.)
- Records predictions 24h before event resolves
- Offers 25% profit share to stakers

**Capitalist Perspective**:
- "Alice has proven edge in crypto (0.16 Brier vs 0.25 baseline)"
- "I don't have time to research BTC technicals"
- "Stake 5 SOL, get 25% of her crypto profits passively"

**Outcome**:
- Alice gets $50k in staked capital
- Makes 20% annual return on crypto predictions
- **Alice earns**: $10k × 75% = $7.5k (no capital risk)
- **Capitalists earn**: $10k × 25% = $2.5k (split among stakers)

---

### Use Case 2: Political Events Specialist

**Forecaster Profile**:
```
Wallet: bob.sol
Avg Brier: 0.21
Sample: 134 predictions
Best Category: Politics (0.18 Brier)
Specialization: US Elections
```

**Strategy**:
- Focuses on election markets (primaries, generals, swing states)
- Deep research on polling data, demographics, historical trends
- Offers 20% profit share

**Capitalist Perspective**:
- "2026 midterms coming up, high trading volume"
- "Bob has 134-prediction track record in politics"
- "His calibration curve shows real skill, not luck"

**Outcome**:
- Bob attracts $200k staked capital before election season
- Makes 30% return during midterm markets
- **Bob earns**: $60k × 80% = $48k (skill monetized without own capital)
- **Capitalists earn**: $60k × 20% = $12k (6% return for passive stake)

---

### Use Case 3: Sports Betting Arbitrage

**Forecaster Profile**:
```
Wallet: carol.sol
Avg Brier: 0.22
Sample: 203 predictions
Best Category: Sports (0.20 Brier)
Strategy: NFL point spreads
```

**Strategy**:
- Exploits inefficiencies between prediction markets and sportsbooks
- High volume, lower edge per trade
- Offers 30% profit share (higher risk, higher reward)

**Capitalist Perspective**:
- "Carol has largest sample size (203 predictions)"
- "Sports is high liquidity category"
- "30% profit share is generous for proven track record"

**Outcome**:
- Carol scales to $500k staked capital
- Makes 12% annual return (lower edge, high volume)
- **Carol earns**: $60k × 70% = $42k (from skill, not bankroll)
- **Capitalists earn**: $60k × 30% = $18k (3.6% return, diversified)

---

## 🔒 Trust & Security Model

### Why Capitalists Can Trust Forecasters

1. **Immutable Track Record**
   - All predictions committed BEFORE outcome known (memo_tx_signature)
   - Brier scores calculated on-chain (no manipulation)
   - Can't delete bad predictions (PDA = permanent)

2. **Verifiable Calibration**
   - Calibration buckets prove skill vs luck
   - If you're just guessing, your Brier → 0.25 over time
   - Real skill = sustained Brier < 0.23

3. **Transparent Profit Sharing**
   - Smart contract enforces profit distribution
   - No trust needed (code is law)
   - Can unstake anytime

### Why Forecasters Benefit

1. **No Capital Required**
   - Performance fees only (no losses)
   - Scale earnings based on skill, not bankroll

2. **Reputation Compounds**
   - Good Brier score → more stakers → more capital → more profits
   - Bad Brier score → unstaking → back to personal capital

3. **Portable Track Record**
   - Your ForecasterState PDA is YOUR asset
   - Take it to any platform, any investor
   - Not locked in centralized database

---

## 🚀 Implementation Roadmap

### Phase 1: ✅ COMPLETED
- On-chain calibration tracking
- Brier score calculation
- PredictionRecord + ForecasterState accounts
- Tests passing, deployed to localnet

### Phase 2: 🔮 PLANNED (Q2 2026)
1. **Accuracy NFT Minting**
   - Link NFT to ForecasterState PDA
   - Metadata: Brier score, sample size, calibration
   - Marketplace listing integration

2. **Staking Mechanism**
   - StakePosition accounts
   - Deposit/withdraw SOL on forecaster NFTs
   - Profit share configuration

3. **Copy Trading Integration**
   - Auto-execute trades on Polymarket/Kalshi
   - Position sizing (Kelly criterion)
   - Risk management (max drawdown limits)

4. **Profit Distribution**
   - Automated settlement after prediction resolves
   - Split profits per profit_share_bps
   - Compound staking (reinvest earnings)

### Phase 3: 🌟 FUTURE
- **Reputation Score**: Weighted avg across time (recent > old)
- **Category-Specific NFTs**: Separate track records per category
- **Delegated Trading**: Forecasters trade directly with staker capital
- **Insurance Pools**: Backstop for capitalists (pay premium)
- **Leaderboards**: Top forecasters by Brier, volume, profits

---

## 💡 Why This Matters for BeRight

### Current BeRight Problem
- Users ask: "Should I buy this market?"
- BeRight provides AI analysis (Tier 2 LLM reasoning)
- But AI has no **skin in the game** or **verifiable track record**

### With Calibration Program
- BeRight agent BECOMES a forecaster
- Every prediction committed on-chain
- Users can verify: "Is BeRight AI actually good?"
- If Brier score < 0.23 → BeRight earns STAKING REVENUE from capitalists

**Economic Model**:
```
BeRight predicts 100 markets/month
→ Avg Brier: 0.21 (proven skill)
→ Attracts $1M in staked capital
→ 15% annual return = $150k profit
→ BeRight takes 70% = $105k/year
→ Stakers get 30% = $45k/year (4.5% yield)

BeRight now has TWO revenue streams:
1. Subscription fees from users
2. Performance fees from capital providers
```

---

## 📚 Resources

**Brier Score Explained**:
- https://en.wikipedia.org/wiki/Brier_score
- Lower is better (0.0 = perfect, 0.25 = random guessing)

**Calibration Curve**:
- https://machinelearningmastery.com/calibration-curves/
- Predicted probability should match actual frequency

**Kelly Criterion** (Position Sizing):
- https://en.wikipedia.org/wiki/Kelly_criterion
- Optimal bet size = (edge × odds) / odds

**Solana Program Accounts**:
- ForecasterState PDA: `findProgramAddressSync([b"forecaster", wallet])`
- PredictionRecord PDA: `findProgramAddressSync([b"prediction", wallet, market_id, timestamp])`

---

**SUMMARY**: The calibration program creates a two-sided marketplace where forecasters monetize skill without capital, and capitalists access proven expertise without research. The on-chain track record solves the trust problem, and smart contracts enforce fair profit distribution. This is live TODAY for forecasters to build reputation, and capitalist staking is coming in Phase 2.
