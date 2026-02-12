# BeRight Agent Heartbeat Checklist

*This file is read by the OpenClaw heartbeat mechanism every 30 minutes.*
*The agent uses this to determine what needs attention.*

## Current Focus

No active goals. Consider generating proactive opportunities.

## Pending Signals (0)

No pending signals.

## Active Goals (0)

No active goals.

## Instructions for Heartbeat

When this file is loaded during heartbeat:

1. **Check Cognitive State**
   - Run the cognitive loop: perceive -> deliberate -> act -> reflect
   - Process any unprocessed signals
   - Evaluate outcomes of past actions

2. **Monitor for Opportunities**
   - Check for arbitrage opportunities > 3% spread
   - Monitor whale activity > $10,000 value
   - Review position risk (> 10% loss)
   - Check for price alert triggers

3. **Goal Management**
   - Review active goals and their priorities
   - Generate proactive goals from opportunities
   - Delegate goals to appropriate agents (Scout, Analyst, Trader)

4. **Learning & Reflection**
   - Analyze recent episodes for patterns
   - Detect cognitive biases
   - Update calibration based on prediction outcomes
   - Sync lessons to MEMORY.md

## Alert Criteria

Generate an alert (don't return HEARTBEAT_OK) if:

- Arbitrage opportunity > 3% spread detected
- Whale movement > $10,000 value
- Position at > 10% loss
- Price alert triggered
- Prediction resolved (for calibration update)
- Goal completed or failed
- Cognitive bias detected requiring correction

## Agent Status

### Scout Agent
- Role: Fast market scanning, arbitrage detection
- Status: idle
- Current Goals: 0

### Analyst Agent
- Role: Deep research, probability estimation
- Status: idle
- Current Goals: 0

### Trader Agent
- Role: Trade execution, risk management
- Status: idle
- Current Goals: 0

### Orchestrator
- Role: Coordination, planning, conflict resolution
- Status: idle
- Current Goals: 0

---

*Updated automatically by the cognitive loop.*
*Last update: (will be populated by system)*
