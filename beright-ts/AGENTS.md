# BeRight Agent Architecture

## Runtime Decision

BeRight now uses a single OpenClaw-native runtime path.

- OpenClaw owns Telegram transport, sessions, bindings, and agent identity.
- BeRight owns routing, orchestration, handlers, formatters, and product logic.

## Primary Agent

`beright-terminal` is the single source of truth for the BeRight terminal experience.

It fronts these product capabilities:
- market discovery
- research and intelligence
- prediction recording
- calibration feedback
- wallet and trading flows
- leaderboard and reputation outputs

## Internal Capabilities

The old persona labels remain useful as internal capability names, not as separate top-level runtime agents:

- `Scout`: discovery, hot markets, arbitrage, news
- `Analyst`: research, synthesis, calibration, forecasting support
- `Trader`: wallet, positions, execution, portfolio views
- `Forecaster`: forecast quality, reasoning, calibration workflows

## Runtime Path

All supported surfaces should converge on the same flow:

`OpenClaw Gateway -> BeRight runtime bridge -> router -> orchestrator -> handler -> formatter`

## Retired Architecture

These are no longer the primary runtime model:

- custom Telegram polling/webhook ownership inside `beright-ts`
- persona-style top-level agent routing under `agents/*`
- duplicate Telegram-specific execution shells

## Design Rule

Do not create a new top-level agent unless you need real isolation:

- separate workspace
- separate memory/session ownership
- separate channel binding
- separate operational identity
