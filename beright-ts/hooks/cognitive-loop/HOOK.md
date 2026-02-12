---
name: cognitive-loop
description: Triggers the agent cognitive loop on gateway events
emoji: "🧠"
events:
  - gateway:startup
  - command:new
  - agent:bootstrap
requires:
  bins: []
  env: []
os: []
---

# Cognitive Loop Hook

This hook integrates the BeRight cognitive loop with OpenClaw's event system.

## Purpose

Triggers the autonomous cognitive cycle when:
- Gateway starts up (initial perception)
- New session starts (context reset)
- Agent bootstraps (initialization)

## Behavior

On each trigger:
1. Loads cognitive state from persistence
2. Runs one cognitive cycle (perceive → deliberate → act → reflect)
3. Syncs memory to MEMORY.md for OpenClaw integration
4. Updates HEARTBEAT.md with current goals and focus

## Configuration

No additional configuration required. Uses the agent's existing memory directory.

## Related Files

- `lib/cognitive/cognitiveLoop.ts` - Main cognitive loop implementation
- `lib/cognitive/goalManager.ts` - Goal persistence
- `lib/cognitive/memory.ts` - Episodic memory
- `lib/cognitive/worldState.ts` - World model
