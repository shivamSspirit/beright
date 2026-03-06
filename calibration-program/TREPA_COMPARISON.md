# Trepa vs BeRight Calibration Program: Competitive Analysis

**Last Updated**: March 5, 2026

---

## 🎯 Executive Summary

Both Trepa and BeRight's Calibration Program target the prediction market space, but with **fundamentally different approaches**:

| Aspect | Trepa | BeRight Calibration Program |
|--------|-------|---------------------------|
| **Model** | Precision prediction **game** | Forecaster-capitalist **marketplace** |
| **Payout** | User vs user competition | Performance fees from stakers |
| **Capital** | Users stake own money | Forecasters access staker capital |
| **Focus** | Numerical accuracy | Calibration + capital allocation |
| **Revenue** | Transaction fees | Performance fees (20-30%) |
| **Blockchain** | Solana | Solana (Anchor) |
| **Status** | Closed beta (V2 coming) | Deployed to localnet (tested) |
| **Track Record** | Leaderboard | On-chain Brier scores + calibration |

**Bottom Line**: Trepa is **precision gambling** where users compete against each other. BeRight is **capital marketplace** where skilled forecasters access investment capital.

---

## 📊 Detailed Comparison

### 1. Core Mechanism

#### Trepa
```
USER A                    TREPA POOL                USER B
  │                            │                        │
  │  Predicts: BTC $110k       │  Predicts: BTC $105k  │
  ├────────────►10 SOL────────►│◄────10 SOL────────────┤
  │                            │                        │
  │        OUTCOME: BTC = $108k (actual)                │
  │                            │                        │
  │  Closer! (2k off)          │        (3k off)        │
  │◄──────15 SOL (75% of pool)─┤                        │
  │                            │──5 SOL─────────────────►│
  └────────────────────────────┴────────────────────────┘

Formula (approximate):
- Payout ∝ 1 / (distance from actual outcome)
- User A: 1/2000 = 0.0005
- User B: 1/3000 = 0.0003
- User A wins 62.5% of pool (0.0005 / 0.0008)
```

**Pros**:
- ✅ Incentivizes numerical precision
- ✅ More engaging than binary markets
- ✅ Users compete directly (zero-sum within pool)

**Cons**:
- ❌ Still need own capital to play
- ❌ No way to monetize skill without bankroll
- ❌ Winner-take-most model (not collaborative)
- ❌ Transaction fees reduce returns

---

#### BeRight Calibration Program
```
FORECASTER                 BLOCKCHAIN              CAPITALIST
(alice.sol)                                       (bob.sol)
     │                          │                      │
     │  1. Build Track Record   │                      │
     ├─────────────────────────►│  Brier: 0.21        │
     │  100 predictions          │  Calibrated: YES    │
     │                          │                      │
     │                          │  2. Stake Capital    │
     │                          │◄─────────────────────┤
     │                          │  Amount: 10 SOL      │
     │                          │                      │
     │  3. Make Prediction      │                      │
     ├─────────────────────────►│  Auto-execute trade  │
     │  BTC $110k (80%)         │  with Bob's capital  │
     │                          │                      │
     │  OUTCOME: Correct ✅     │                      │
     │  Profit: 2 SOL           │                      │
     │                          │                      │
     │◄────1.6 SOL (80%)────────┤────0.4 SOL (20%)────►│
     │  Performance fee         │  Passive yield       │
     └──────────────────────────┴──────────────────────┘

Formula:
- Forecaster: profit × (1 - profit_share_bps)
- Capitalist: profit × profit_share_bps
- NO DOWNSIDE for forecaster (only upside)
- Capitalist has downside but verified track record
```

**Pros**:
- ✅ Forecasters scale without own capital
- ✅ Capitalists access proven expertise
- ✅ Win-win model (not zero-sum)
- ✅ On-chain verification (Brier scores, calibration)

**Cons**:
- ❌ More complex architecture (Phase 2 not live yet)
- ❌ Requires trust in smart contract enforcement
- ❌ Capital providers take on risk

---

### 2. Track Record & Verification

#### Trepa
- **Leaderboard**: Ranks users by "consistency and forecasting skill"
- **Streaks**: "Streakpots" reward consecutive accurate predictions
- **Reputation**: Based on platform-specific performance

**Issues**:
- ❌ No mention of **Brier scores** or formal calibration metrics
- ❌ Leaderboard likely **not portable** (centralized to Trepa)
- ❌ No way to prove skill to **external investors**
- ❌ "Accuracy" could mean different things (absolute error? percentile ranking?)

**Example**:
```
Trepa Leaderboard (hypothetical):
1. alice.sol - 87 correct predictions, 12 incorrect (87% accuracy)
2. bob.sol - 65 correct, 8 incorrect (89% accuracy)
3. carol.sol - 120 correct, 30 incorrect (80% accuracy)

Problem: Who's actually better?
- bob.sol has higher % but smaller sample
- alice.sol predicted easier markets
- carol.sol predicted harder markets but larger sample
- No calibration data (overconfident vs underconfident)
```

---

#### BeRight Calibration Program
- **Brier Score**: Industry-standard metric (0.0 = perfect, 0.25 = random)
- **Calibration Buckets**: Proves you're not just lucky (predicted 70% → happens 70%)
- **On-Chain PDAs**: Immutable, portable track record
- **Standardized Metrics**: Comparable across platforms

**Advantages**:
- ✅ **Portable reputation** (take your PDA anywhere)
- ✅ **Verifiable calibration** (not just "accuracy")
- ✅ **Standardized** (Brier score is industry standard)
- ✅ **Tamper-proof** (committed BEFORE outcome via Memo program)

**Example**:
```
BeRight ForecasterState:
{
  avg_brier_score: 0.21,  // Top 10% (0.25 = baseline)
  sample_size: 134,
  calibration_buckets: [
    [0-10%]: predicted 23 times, happened 2 times (8.7% actual)
    [10-20%]: predicted 12 times, happened 2 times (16.7% actual)
    [20-30%]: predicted 18 times, happened 5 times (27.8% actual)
    [30-40%]: predicted 15 times, happened 5 times (33.3% actual)
    [40-50%]: predicted 9 times, happened 4 times (44.4% actual)
    [50-60%]: predicted 14 times, happened 8 times (57.1% actual)
    [60-70%]: predicted 19 times, happened 13 times (68.4% actual)
    [70-80%]: predicted 11 times, happened 8 times (72.7% actual)
    [80-90%]: predicted 8 times, happened 7 times (87.5% actual)
    [90-100%]: predicted 5 times, happened 5 times (100% actual)
  ]
}

Analysis: Well-calibrated! R² = 0.94
Investor confidence: HIGH (proven skill, not luck)
```

---

### 3. Capital Model

#### Trepa
**User Must Provide Own Capital**:
- Stake own SOL to enter prediction pools
- Win by being more accurate than 50% of peers
- Limited by personal bankroll

**Scenario**:
```
Alice has $1,000 bankroll
→ Can stake max $100 per prediction (Kelly criterion @ 10% edge)
→ 10 predictions/month
→ 15% annual return = $150/year profit
→ Limited by capital, not skill
```

**Capital Scaling**: ❌ None (unless Alice gets external loan/investment separately)

---

#### BeRight Calibration Program
**Forecaster Accesses Staker Capital**:
- Build track record with minimal capital (just tx fees)
- Attract staker capital based on proven Brier score
- Scale earnings infinitely with skill

**Scenario**:
```
Alice has $100 bankroll (same person!)
→ Records 100 predictions (cost: ~$30 in tx fees)
→ Builds 0.21 Brier score (top 10%)
→ Attracts $100,000 staked capital
→ Same 15% annual return on $100k = $15,000 profit
→ Alice earns 80% = $12,000/year
→ 120x MORE than Trepa model!
```

**Capital Scaling**: ✅ Unlimited based on skill + reputation

---

### 4. Economic Incentives

#### Trepa: Zero-Sum Within Pool
```
Total Pool: 100 SOL (from all participants)
Winner takes: 60-70% of pool
Losers get: 0-30% of pool (proportional to accuracy)

Revenue Model (Trepa):
- Transaction fees (deducted from pool)
- Platform keeps ~5-10% of each pool

Problem: Users compete AGAINST each other
- If you win, someone else loses
- No collaborative growth
```

---

#### BeRight: Positive-Sum Market
```
Total Staked: 100 SOL (from capitalists)
Profit: 15 SOL (from prediction market gains)
Forecaster gets: 12 SOL (80%)
Capitalists get: 3 SOL (20%) split among stakers

Revenue Model (BeRight):
- Performance fees (20-30% of profits)
- No transaction fees

Benefit: Win-win collaboration
- Forecaster profits without capital risk
- Capitalists profit without time investment
- Both grow together
```

---

### 5. User Experience

#### Trepa
**Strengths**:
- ✅ Simple UX: "Predict, stake, claim"
- ✅ No crypto knowledge required (fiat onramp)
- ✅ Gamified (leaderboards, streaks)
- ✅ Immediate engagement (can start playing now)

**Weaknesses**:
- ❌ Must have capital to participate
- ❌ Need to beat 50% of peers to profit
- ❌ Winner-take-most discourages casual players
- ❌ No way to "go pro" without large bankroll

**Target User**: Retail prediction market enthusiasts with $500-$5k to play

---

#### BeRight Calibration Program
**Strengths**:
- ✅ No capital required for forecasters (just tx fees ~$0.30/prediction)
- ✅ Portable track record (PDA = your asset)
- ✅ Professional monetization path
- ✅ Passive income for capitalists

**Weaknesses**:
- ❌ More complex (two-sided marketplace)
- ❌ Forecasters must build track record first (100+ predictions)
- ❌ Phase 2 (staking) not live yet
- ❌ Requires understanding of Brier scores

**Target User**:
- Forecasters: Skilled predictors wanting to "go pro"
- Capitalists: Investors seeking alpha without research time

---

### 6. Technology Stack

#### Trepa
- **Blockchain**: Solana
- **Smart Contracts**: Not specified (likely Anchor or native Rust)
- **Audit**: Audited by Adevar Labs
- **Status**: Closed beta (V2 coming soon)
- **Funding**: $420k pre-seed (August 2025)

**Unknown**:
- State compression usage?
- PDA architecture?
- Event emission for indexing?

---

#### BeRight Calibration Program
- **Blockchain**: Solana
- **Framework**: Anchor 0.32.1
- **Architecture**:
  - ForecasterState PDA: `[b"forecaster", authority]`
  - PredictionRecord PDA: `[b"prediction", authority, market_id, timestamp]`
- **Metrics**: Brier score, log score, calibration buckets
- **Status**: Deployed to localnet, all tests passing
- **Audit**: Not yet (would be needed before mainnet)

**Future**:
- State compression for 99% cost reduction
- AccuracyNFT for staking
- Copy trading integration

---

## 🎮 Use Case Comparison

### Scenario: Alice is a Skilled Crypto Forecaster

#### Using Trepa
```
Month 1: Alice enters 20 crypto prediction pools
- Average stake: $50 per pool ($1,000 total capital deployed)
- Win rate: 60% (beats 50% threshold in 12/20 pools)
- Average payout multiplier: 1.8x on wins
- Earnings: (12 × $50 × 1.8) - (8 × $50) = $680
- ROI: -32% (lost $320 despite 60% win rate!)

Problem: Even with skill, variance hurts
- Few bad predictions wipe out gains
- Need large bankroll to smooth variance
- Transaction fees eat into small stakes
```

#### Using BeRight
```
Month 1: Alice records 20 predictions (no stakes yet)
- Cost: 20 × $0.27 = $5.40 in tx fees
- Track record: 15/20 correct (75%)
- Brier score: 0.23 (good but needs more sample)

Month 3: After 60 predictions
- Brier score: 0.21 (top 10%)
- Attracts first staker: 5 SOL ($500)

Month 6: After 120 predictions
- Brier score: 0.20 (top 5%)
- Total staked: $50,000
- 15% annual return = $7,500/year
- Alice earns 80% = $6,000/year
- Alice invested: $36 in tx fees
- ROI: 16,567% on capital invested!

Result: Skill monetized without bankroll risk
```

---

### Scenario: Bob is a Capitalist with $10k

#### Using Trepa
```
Bob doesn't have time to research predictions
→ Can't participate in Trepa (need to make own predictions)
→ Money sits idle in traditional DeFi (3-5% yield)

Alternative: Bob could make random predictions
→ Expected Brier: 0.25 (baseline)
→ Likely loses money over time
→ Not a good use case for capitalists
```

#### Using BeRight
```
Bob filters for proven forecasters:
- Brier < 0.23
- Sample size > 100
- Specialization: Crypto

Bob finds 5 forecasters:
- alice.sol (0.20 Brier, 150 predictions)
- carol.sol (0.21 Brier, 200 predictions)
- dave.sol (0.19 Brier, 180 predictions)
- eve.sol (0.22 Brier, 120 predictions)
- frank.sol (0.21 Brier, 140 predictions)

Bob stakes $2k on each (diversified)
Expected annual yield: 12-15%
Bob's passive income: $1,200-$1,500/year
No research time required ✅
```

---

## ⚔️ Competitive Positioning

### Trepa's Strengths (Why They Might Win)

1. **Simpler to Understand**
   - "Predict number, win money" is easier than "build track record, attract stakers"
   - Lower barrier to entry

2. **Immediate Gratification**
   - Users can play NOW (beta access)
   - Don't need to build track record first

3. **Gamification**
   - Leaderboards and streaks are addictive
   - Social proof and competition drive engagement

4. **Funding**
   - $420k pre-seed gives runway for marketing/development
   - Professional team and audit completed

5. **No Two-Sided Marketplace Problem**
   - Don't need forecasters AND capitalists
   - Just need users who want to play

**Market**: Retail prediction market enthusiasts, DeFi gamblers

---

### BeRight's Strengths (Why We Might Win)

1. **Professional Monetization**
   - Skilled forecasters can "go pro" without capital
   - Career path for superforecasters

2. **Institutional Appeal**
   - Capitalists (funds, DAOs, whales) want verified track records
   - Brier scores are industry standard (Metaculus, GJP, etc.)

3. **Portable Reputation**
   - ForecasterState PDA = your asset (take it anywhere)
   - Not locked into Trepa's platform

4. **Scientific Rigor**
   - Calibration curves prove skill vs luck
   - Brier scores are academically validated

5. **Win-Win Economics**
   - Positive-sum market (forecasters + capitalists both benefit)
   - Trepa is zero-sum within pools

6. **BeRight Integration**
   - BeRight AI becomes forecaster
   - Two revenue streams (subscriptions + performance fees)
   - Network effect with existing Telegram bot users

**Market**: Professional forecasters, prediction market funds, AI agents

---

## 🎯 Strategic Recommendations

### For BeRight Calibration Program

**Short-Term (Q2 2026)**:
1. ✅ Complete Phase 1: On-chain calibration tracking (DONE)
2. 🔄 Deploy to Solana devnet for public testing
3. 🔄 Integrate with BeRight Telegram bot (record all predictions)
4. 🔄 Build 100+ prediction track record for BeRight AI

**Medium-Term (Q3 2026)**:
5. 🔮 Implement Phase 2: AccuracyNFT + staking mechanism
6. 🔮 Launch forecaster marketplace (show verified track records)
7. 🔮 Partner with Polymarket/Kalshi for copy trading
8. 🔮 Get smart contract audit (before mainnet)

**Long-Term (Q4 2026+)**:
9. 🔮 Mainnet launch with institutional marketing
10. 🔮 Re-enable state compression (99% cost reduction)
11. 🔮 Build leaderboards and social features (compete with Trepa's gamification)
12. 🔮 White-label solution for prediction market platforms

---

### Differentiation Strategy

**Don't compete with Trepa on gamification** (they have head start)

**Instead, OWN these narratives**:

1. **"Professional Forecasting Platform"**
   - BeRight = LinkedIn for forecasters
   - Trepa = Twitch for prediction gamers
   - Target different users!

2. **"Verified Track Records"**
   - Emphasize Brier scores, calibration curves
   - Partner with Metaculus, Good Judgment Project
   - Academic credibility

3. **"Capital Marketplace"**
   - Forecasters access staker capital
   - Two-sided network effect
   - Trepa can't replicate this easily

4. **"AI-Native"**
   - BeRight AI agent demonstrates the model
   - "Our AI has 0.19 Brier score - stake on it!"
   - Unique positioning vs human-only platforms

5. **"Interoperable Reputation"**
   - ForecasterState PDA = portable asset
   - Can use it on ANY platform (not just BeRight)
   - Solana-native credibility layer

---

## 📊 Market Size Analysis

### Trepa's TAM (Total Addressable Market)
- Prediction market enthusiasts with capital
- DeFi gamblers seeking numerical bets
- Estimated: **$500M-$1B** (subset of prediction market users)

### BeRight's TAM
- **Forecasters**: Superforecasters, analysts, researchers
  - Good Judgment Project: ~30k forecasters
  - Metaculus: ~20k active users
  - Prediction market traders: ~200k
  - **Potential**: 100k professional forecasters

- **Capitalists**: Funds, DAOs, whales seeking alpha
  - Prediction market funds: $50M-$100M AUM
  - DeFi whales: $10B+ looking for yield
  - **Potential**: $1B in staked capital

**Combined TAM: $5B-$10B** (larger than Trepa because two-sided)

---

## 🏆 Conclusion

### Can Both Coexist? YES

**Trepa** = Retail prediction game (compete against peers)
- User: "I want to test my prediction skills and win money"
- Capital: Own bankroll ($500-$5k)
- Goal: Leaderboard ranking, streaks, social proof

**BeRight** = Professional forecaster marketplace (access capital)
- User: "I'm a skilled forecaster, help me monetize it"
- Capital: Staker capital ($10k-$1M+)
- Goal: Career as professional forecaster, passive investor yield

### Who Wins?

**Trepa wins if**: Gamification > verified track records
- Most users want to compete and have fun
- Leaderboards drive more engagement than Brier scores

**BeRight wins if**: Verification > competition
- Skilled forecasters want to "go pro"
- Capitalists demand proven track records
- AI agents need credibility layers

**My Prediction**: BeRight has **stronger moat** (two-sided marketplace harder to replicate) but Trepa has **faster growth** (simpler onboarding). Both can succeed in different niches.

---

## 📚 Sources

- [Trepa Website](https://www.trepa.io/)
- [Trepa Review - CoinCodeCap](https://coincodecap.com/trepa-review)
- [Trepa Funding News](https://www.cmointern.com/2025/08/trepa-secures-420k-pre-seed-for-web3.html)
- [Trepa Origin Story](https://www.trepa.io/articles/trepas-origin-story)
- BeRight Calibration Program (this repo)
