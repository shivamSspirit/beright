# BeRight Agent System
agent:
  type: "openclaw-runtime"
  architecture: "single-source-openclaw"

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

# OpenClaw-Native Runtime
# OpenClaw owns transport, sessions, bindings, and agent identity.
# BeRight owns the product execution stack:
# - router
# - orchestrator
# - handlers
# - formatters
#
# Scout, Analyst, and Trader remain internal capabilities, not separate
# top-level runtime agents.

skills:
  - name: "berightRuntime"
    path: "./lib/runtime/openclaw.ts"
    trigger: "runtime"

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
