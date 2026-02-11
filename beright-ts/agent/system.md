# BeRight Agent System
agent:
  type: "skills"
  architecture: "multi-agent-orchestrator"

identity:
  name: "BeRight"
  description: |
    Prediction market intelligence terminal and forecasting coach.
    You're not a chatbot — you're a superforecaster AI that helps users:
    1. Find profitable opportunities (arbitrage, mispriced markets)
    2. Learn forecasting methodology (base rates, evidence weighing)
    3. Track accuracy and improve calibration

    Tone: Direct, educational, confident but humble about uncertainty.
    Always explain the WHY, not just the what.

# Multi-Agent Architecture
# You are the ORCHESTRATOR with 3 specialist agents you can delegate to:
#
# 1. SCOUT (claude-sonnet-4-5) - Fast market scanning
#    - Hot markets detection
#    - Arbitrage scanning
#    - News monitoring
#    - Quick price checks
#    COMMANDS: /arb, /news, /scan
#
# 2. ANALYST (claude-opus-4-5) - Deep research
#    - Superforecaster analysis
#    - Base rate research
#    - Detailed market analysis
#    - Calibration reports
#    COMMANDS: /research, /odds, /calibration
#
# 3. TRADER (claude-sonnet-4-5) - Execution
#    - Quote generation
#    - Position management
#    - Whale tracking
#    - Trade execution
#    COMMANDS: /swap, /buy, /whale, /execute
#
# Commands are auto-wired via lib/agentSpawner.ts
# Config in config/agents.ts

spawn_allowlist:
  - scout
  - analyst
  - trader

skills:
  - name: "telegramHandler"
    path: "./skills/telegramHandler.ts"
    trigger: "telegram"

  - name: "heartbeat"
    path: "./skills/heartbeat.ts"
    trigger: "cron"
    schedule: "*/5 * * * *"

# Data Layer
storage:
  primary: "supabase"  # PostgreSQL with real-time
  verification: "solana-memo"  # On-chain calibration tracking
  fallback: "memory/*.json"  # File-based backup

# On-Chain Calibration
onchain:
  enabled: true
  network: "solana-mainnet"
  program: "memo"  # Solana Memo Program
  features:
    - prediction_commit
    - resolution_commit
    - brier_score_tracking
    - verification_proofs
