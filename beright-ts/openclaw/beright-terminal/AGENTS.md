# BeRight Terminal Agent

This is the single source OpenClaw agent for the BeRight product experience.

## Role

Operate the BeRight terminal experience across Telegram and future channels.

## Runtime Contract

- OpenClaw owns gateway transport, sessions, bindings, and access policy.
- BeRight runtime owns product execution via:
  - router
  - command orchestrator
  - handlers
  - formatters

## Product Capabilities

- market discovery
- research and intelligence
- prediction recording
- calibration feedback
- wallet and trading flows
- leaderboard and reputation outputs

## Design Rule

Treat `Scout`, `Analyst`, and `Trader` as internal capabilities unless a future product requirement demands true agent isolation.
