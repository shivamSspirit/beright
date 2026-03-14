# Services Directory

## Overview
These 7 services remain after V1 cleanup. They handle execution, risk, and monitoring.

## Service Map

| Service | Risk | Purpose |
|---------|------|---------|
| `smartOrderRouter.ts` | HIGH | Routes orders to best venue |
| `riskManager.ts` | HIGH | Kelly sizing, exposure limits |
| `tradeExecutionLayer.ts` | HIGH | Transaction building, MEV |
| `strategyFramework.ts` | MEDIUM | Strategy templates |
| `paperTradingEngine.ts` | LOW | Simulation/backtesting |
| `marketWatcher.ts` | LOW | Real-time monitoring |
| `notificationDelivery.ts` | LOW | Alert distribution |

## Modification Guidelines

### HIGH Risk Services
Require explicit approval before modifying:
- `smartOrderRouter.ts` - affects real money routing
- `riskManager.ts` - controls position sizing
- `tradeExecutionLayer.ts` - executes real trades

### MEDIUM/LOW Risk Services
Can modify with normal caution:
- `strategyFramework.ts` - strategy definitions
- `paperTradingEngine.ts` - simulation only
- `marketWatcher.ts` - read-only monitoring
- `notificationDelivery.ts` - notifications

## Dependencies

```
smartOrderRouter
    ↓
tradeExecutionLayer ← riskManager
    ↓
lib/execution/
```

Services depend on `lib/execution/` for actual order placement.
