# Handler Migration Plan

## Overview

Migrating 40+ handlers from `skills/telegramHandler.ts` (3,850 lines) to `lib/orchestrator/handlers/`.

Each handler migration follows this pattern:
1. Create handler file in `lib/orchestrator/handlers/{name}.ts`
2. Return structured data (not formatted text)
3. Add route to `lib/router/routes.config.ts`
4. Add formatter method if needed
5. Delete legacy code from `telegramHandler.ts`

---

## Migration Phases

### Phase 1: Core Discovery (High Usage)
| Handler | Route | Status |
|---------|-------|--------|
| `hotMarkets` | `/hot`, `/trending` | DONE |
| `brief` | `/brief` | TODO |
| `research` | `/research <topic>` | TODO |
| `alpha` | `/alpha` | TODO |

### Phase 2: DFlow Trading
| Handler | Route | Status |
|---------|-------|--------|
| `dflowSearch` | `/dflow <query>` | TODO |
| `dflowTrade` | `/trade <ticker> <side> <amount>` | TODO |
| `dflowPositions` | `/positions` | TODO |
| `dflowWallet` | `/wallet` | TODO |
| `quote` | `/quote <ticker> <side> <amount>` | TODO |

### Phase 3: Kalshi Trading
| Handler | Route | Status |
|---------|-------|--------|
| `kalshiOverview` | `/kalshi` | TODO |
| `kalshiMarkets` | `/kalshi markets <query>` | TODO |
| `kalshiBuy` | `/kalshi buy <ticker> <side> <amount>` | TODO |
| `kalshiSell` | `/kalshi sell <ticker> <amount>` | TODO |
| `kalshiPositions` | `/kalshi positions` | TODO |
| `kalshiBalance` | `/kalshi balance` | TODO |
| `kalshiOrders` | `/kalshi orders` | TODO |
| `kalshiCancel` | `/kalshi cancel <orderId>` | TODO |

### Phase 4: Portfolio & Analytics
| Handler | Route | Status |
|---------|-------|--------|
| `portfolio` | `/portfolio` | TODO |
| `pnl` | `/pnl` | TODO |
| `me` | `/me` | TODO |
| `calibration` | `/calibration` | TODO |
| `leaderboard` | `/leaderboard` | TODO |
| `compare` | `/compare` | TODO |

### Phase 5: Predictions & Intelligence
| Handler | Route | Status |
|---------|-------|--------|
| `predict` | `/predict <market>` | TODO |
| `smartPredict` | `/smartpredict <topic>` | TODO |
| `intelligence` | `/intel <topic>` | TODO |
| `recommendations` | `/recommend` | TODO |
| `feedback` | `/feedback` | TODO |
| `learnings` | `/learnings` | TODO |

### Phase 6: Automation
| Handler | Route | Status |
|---------|-------|--------|
| `alert` | `/alert <ticker> <price>` | TODO |
| `autobet` | `/autobet` | TODO |
| `stopLoss` | `/stoploss <ticker> <price>` | TODO |
| `takeProfit` | `/takeprofit <ticker> <price>` | TODO |
| `dca` | `/dca` | TODO |
| `limits` | `/limits` | TODO |

### Phase 7: Market Analysis
| Handler | Route | Status |
|---------|-------|--------|
| `scan` | `/scan` (arbitrage) | TODO |
| `closing` | `/closing` | TODO |
| `expiring` | `/expiring` | TODO |
| `volume` | `/volume` | TODO |
| `whale` | `/whale` | TODO |

### Phase 8: System & Utility
| Handler | Route | Status |
|---------|-------|--------|
| `help` | `/help`, `/start` | TODO |
| `settings` | `/settings` | TODO |
| `connect` | `/connect` | TODO |
| `subscribe` | `/subscribe` | TODO |
| `semantic` | (fallback) | DONE |

---

## Handler Template

```typescript
/**
 * {Name} Handler
 */

import { CommandHandler, CommandContext, CommandResult } from '../types';
import { registerHandler } from './registry';

// Types
export interface {Name}Result {
  // Structured data
}

// Handler
export const {name}Handler: CommandHandler<{Name}Result> = {
  id: '{name}',
  skillsUsed: ['...'],

  async execute(context: CommandContext): Promise<CommandResult<{Name}Result>> {
    const startTime = Date.now();

    try {
      // 1. Extract params from context
      // 2. Call skill(s)
      // 3. Transform to structured result
      // 4. Return success

      return {
        success: true,
        data: result,
        meta: {
          handlerId: '{name}',
          routeId: context.route.id,
          executedAt: new Date(),
          durationMs: Date.now() - startTime,
          skillsUsed: ['...'],
          apiCallsMade: 1,
        },
        hints: {
          mood: 'NEUTRAL',
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ERROR_CODE',
          message: error instanceof Error ? error.message : 'Failed',
          retryable: true,
        },
        meta: { ... },
        hints: { mood: 'ERROR' },
      };
    }
  },
};

// Auto-register
registerHandler({name}Handler);

export default {name}Handler;
```

---

## Progress Tracking

- [ ] Phase 1: Core Discovery (4 handlers)
- [ ] Phase 2: DFlow Trading (5 handlers)
- [ ] Phase 3: Kalshi Trading (8 handlers)
- [ ] Phase 4: Portfolio & Analytics (6 handlers)
- [ ] Phase 5: Predictions & Intelligence (6 handlers)
- [ ] Phase 6: Automation (6 handlers)
- [ ] Phase 7: Market Analysis (5 handlers)
- [ ] Phase 8: System & Utility (5 handlers)

**Total: 45 handlers**
