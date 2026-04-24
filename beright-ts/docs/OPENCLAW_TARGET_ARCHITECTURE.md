# BeRight OpenClaw Target Architecture

**Status:** Target Architecture
**Date:** 2026-04-24
**Owner:** BeRight Protocol

## Goal

Make `beright-ts` an OpenClaw-native product runtime.

BeRight keeps its product logic:
- prediction market aggregation
- AI-assisted terminal workflows
- Solana-linked forecast recording
- calibration, scoring, and leaderboard outputs

OpenClaw becomes the only agent runtime:
- Gateway owns Telegram and other messaging surfaces
- Gateway owns sessions, slash commands, and access policy
- Agent routing happens through OpenClaw bindings and workspaces
- BeRight business logic is executed underneath that shell

## Architectural Decision

BeRight should use **one primary OpenClaw agent** for the core product experience:

- `beright-terminal`

This agent is the BeRight product in Telegram and other channels.

`Scout`, `Analyst`, and `Trader` remain useful concepts, but they should be implemented as:
- internal capabilities
- command handlers
- product modules

They should **not** be separate top-level OpenClaw agents unless we need true isolation:
- separate workspace
- separate session store
- separate auth profiles
- separate channel/account bindings

That matches OpenClaw's agent model more accurately and preserves a coherent BeRight terminal UX.

## Source Of Truth

### OpenClaw Owns

- Telegram transport and bot lifecycle
- direct-message access policy
- pairing / allowlists
- session routing and session storage
- slash commands
- channel bindings
- agent workspace selection

### BeRight Owns

- market ingestion and normalization
- research and intelligence logic
- prediction recording
- scoring and leaderboard logic
- wallet, quoting, and execution logic
- formatting and UX behavior specific to BeRight responses

## Target Runtime Layout

```text
Telegram / Web / Other Channels
          |
          v
    OpenClaw Gateway
    - channels
    - pairing / allowlists
    - sessions
    - slash commands
    - bindings
          |
          v
  OpenClaw Agent: beright-terminal
    - AGENTS.md
    - SOUL.md
    - skills allowlist
    - workspace
          |
          v
  BeRight Runtime Bridge
    - normalize request
    - route command / semantic fallback
    - build command context
    - execute orchestrator
    - format response
          |
          v
  BeRight Product Modules
    - lib/dataFabric/*
    - lib/analyst/*
    - lib/execution/*
    - lib/onchain/*
    - lib/orchestrator/handlers/*
    - calibration / scoring / leaderboard modules
```

## What We Keep

These are product modules and should remain:

- `lib/dataFabric/*`
- `lib/analyst/*`
- `lib/execution/*`
- `lib/onchain/*`
- `lib/orchestrator/handlers/*`
- `lib/router/*`
- `lib/gateway/formatters/*`
- scoring, calibration, oracle, leaderboard, and ingestion modules

## What Becomes Legacy

These have been retired from the primary runtime path:

- `skills/telegram.ts`
- `app/api/telegram/webhook/route.ts`
- `app/api/telegram/setup/route.ts`
- `lib/secureHandler.ts`
- `lib/channelSecurity.ts`
- `lib/telegramLock.ts`
- the old persona-agent runtime under `agents/*` as the main execution shell

## Current Gap

The repo currently mixes three runtime models:

1. Legacy custom Telegram runtime
2. Persona-style custom agents in `agents/*`
3. Newer gateway/router/orchestrator handler stack in `lib/*`

That overlap creates:
- duplicated entrypoints
- duplicated routing
- inconsistent session ownership
- confusion about what an “agent” means

## Target Principles

1. **One ingress path per surface**
   Telegram should enter through OpenClaw Gateway, not BeRight-owned polling/webhook code.

2. **One execution model**
   Requests should flow through the handler-based orchestrator path.

3. **One primary product agent**
   `beright-terminal` is the main OpenClaw agent for the BeRight experience.

4. **Capabilities over faux agents**
   Product subdomains stay as handlers/modules unless isolation is genuinely required.

5. **Session ownership belongs to OpenClaw**
   Multi-user Telegram deployments should use OpenClaw DM isolation, typically `per-channel-peer`.

## Recommended OpenClaw Configuration Shape

Illustrative target:

```json5
{
  gateway: {
    mode: "local"
  },
  session: {
    dmScope: "per-channel-peer"
  },
  agents: {
    defaults: {
      workspace: "~/.openclaw/workspace-beright",
      model: {
        primary: "anthropic/claude-sonnet-4-6"
      }
    },
    list: [
      {
        id: "beright-terminal",
        name: "BeRight Terminal",
        workspace: "~/.openclaw/workspace-beright",
        skills: []
      }
    ]
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "env:TELEGRAM_BOT_TOKEN",
      dmPolicy: "pairing",
      groups: {
        "*": { requireMention: true }
      }
    }
  },
  bindings: [
    {
      agentId: "beright-terminal",
      match: { channel: "telegram" }
    }
  ]
}
```

Note:
- The BeRight agent should call BeRight runtime modules.
- OpenClaw should own transport, identity, and session state.

## Migration Phases

### Phase 1: Define the OpenClaw-native runtime bridge

- Create one runtime entrypoint for BeRight command execution
- Ensure handler registration and formatter loading happen in one place
- Route web terminal requests through that runtime instead of the legacy Telegram wrapper

### Phase 2: Stop using legacy Telegram as the source of truth

- Remove BeRight-owned polling and webhook ingress
- Move Telegram execution onto OpenClaw Gateway bindings

### Phase 3: Retire the old persona-agent runtime

- Remove `agents/*` as the primary runtime shell
- Keep only domain capabilities that still matter

### Phase 4: Clean up remaining duplication

- remove stale telegram-specific orchestration
- remove duplicated routing logic
- collapse session handling around OpenClaw ownership

## Implementation Rule

During migration, every new integration should target:

- router → orchestrator → handler → formatter

and never:

- fake Telegram message → secure wrapper → legacy telegram handler

## End State

BeRight becomes:
- a single coherent OpenClaw-native product agent
- with internal market, prediction, and trading capabilities
- exposed consistently across Telegram, web terminal, and future channels

This gives us:
- cleaner runtime ownership
- less duplication
- better session safety
- simpler future maintenance
- better alignment with OpenClaw’s architecture contract
