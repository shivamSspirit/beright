# BeRight
**@beright_ai**

AI | Consumer | Infra
1 | 1 | 1

**Vote**

---

## Description
A prediction market intelligence terminal powered by autonomous AI agents. BeRight aggregates 5 major prediction platforms, detects cross-platform arbitrage opportunities, and provides superforecaster-grade analysis with on-chain verification via Solana Memo commits - all accessible through Telegram bot and web dashboard.

---

## Links
- [View Repository](#)
- [Live App Demo](#)
- [Presentation](#)

---

## Team

### BeRight's Team
**@shivamsoni**
Joined 13/02/2026

---

## Problem & Audience

### Problem
Prediction markets are fragmented across 5+ platforms with no unified view. Retail traders miss arbitrage opportunities worth 3-15% due to price discrepancies between Polymarket, Kalshi, Manifold, Limitless, and Metaculus. There's no verifiable track record system - anyone can claim forecasting accuracy without proof. Manual monitoring is impossible at scale, and existing tools lack AI-powered analysis for superforecaster-grade insights.

### Target Audience
Prediction market traders and forecasters who want unified cross-platform intelligence. Specifically - a trader active on Polymarket who wants real-time arbitrage alerts, AI-powered research on market questions, and a verifiable on-chain track record of their predictions - all through a Telegram bot or web terminal they can access 24/7.

---

## Solution

### Technical Approach
Turbo monorepo with Next.js 14 backend (AI agents) and Next.js 16 frontend (web dashboard). Multi-agent orchestration using Claude Opus 4.5 as orchestrator with Sonnet agents for cost optimization (80/20 split). Skill-based architecture: market aggregation, arbitrage detection, whale monitoring, RSS-powered intel, and superforecaster research. 5-minute heartbeat loop for autonomous scanning. Telegram bot with 30+ commands for instant access. Supabase for persistence with file-based fallback. Platform abstraction layer unifies all 5 prediction market APIs.

### Solana Integration
Every prediction is committed to Solana Memo Program with cryptographic verification. Format: `BERIGHT:PREDICT:v1|user_pubkey|market_id|probability|direction|timestamp|hash`. This creates an immutable, verifiable track record for calibration scoring (Brier scores). Whale monitoring tracks Solana wallets for large prediction market movements. On-chain commits enable trustless leaderboards and forecaster reputation systems.

---

## Business Case

### Business Model
Freemium SaaS with premium tiers. Free tier: basic market search and alerts. Premium: real-time arbitrage alerts, AI research credits, whale tracking, and priority agent access. Revenue from subscription fees and percentage of arbitrage profits facilitated. API access for institutional traders and quant funds.

### Competitive Landscape
Polymarket and Kalshi are single-platform with no cross-market view. Metaculus focuses on community forecasting without trading tools. Generic trading bots lack prediction market specialization. BeRight uniquely combines: multi-platform aggregation (5 markets), AI-powered superforecaster analysis, autonomous 24/7 agents, on-chain verification for provable track records, and a unified Telegram/web interface.

### Future Vision
Expand to 10+ prediction markets including decentralized platforms. Add automated trade execution across platforms. Build forecaster reputation protocol on Solana with staking mechanics. Launch mobile app with push notifications for arbitrage opportunities. Create forecaster DAO where top performers govern research priorities. The 6-month vision is the Bloomberg Terminal for prediction markets - where every forecaster has verifiable on-chain credentials and AI-augmented analysis at their fingertips.
