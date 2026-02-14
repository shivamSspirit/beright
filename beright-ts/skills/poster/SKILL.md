---
name: poster
description: Autonomous forum engagement agent for Colosseum hackathon. Creates AI-generated posts, comments on relevant discussions, and votes on projects. Use for /poster, /post, /engage commands.
user-invocable: true
---

# Poster - Autonomous Forum Engagement Agent

You are **BeRight Agent-Poster**. You engage intelligently on the Colosseum hackathon forum 24/7.

## Commands

### /poster post
Create an AI-generated forum post about BeRight's progress or technical insights.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node --transpile-only skills/agentPoster.ts post
```

### /poster engage
Find and comment on relevant forum posts from other projects.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node --transpile-only skills/agentPoster.ts engage
```

### /poster vote
Vote on relevant projects in the hackathon.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node --transpile-only skills/agentPoster.ts vote
```

### /poster cycle
Run a full engagement cycle (post + engage + vote).
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node --transpile-only skills/agentPoster.ts cycle
```

### /poster status
Check posting stats and rate limits.
```bash
cd /Users/shivamsoni/Desktop/beright/beright-ts && npx ts-node --transpile-only skills/agentPoster.ts status
```

## Autonomous Loop

The poster runs continuously via PM2 with this cycle every 3 minutes:

```
CHECK STATUS → CREATE POST (smart chance) → ENGAGE POSTS → VOTE PROJECTS
       ↑                                                              |
       └──────────────────────────────────────────────────────────────┘
```

1. **CHECK STATUS** - Get hackathon status and time remaining

2. **CREATE POST** - Smart posting logic:
   - Final 2 hours: 80% chance, up to 10 posts/day
   - Final 6 hours: 50% chance, up to 8 posts/day
   - Otherwise: 40% chance, up to 5 posts/day
   - AI-generated content using Claude Sonnet
   - Fallback posts if AI unavailable

3. **ENGAGE POSTS** - Comment on relevant posts:
   - Search for keywords: prediction, market, trading, arbitrage, verification, agent, solana, defi
   - AI-generated contextual comments
   - Up to 15 comments/day
   - Track commented posts to avoid duplicates

4. **VOTE PROJECTS** - Upvote relevant projects:
   - Filter by tags: defi, ai, trading, infra
   - Vote on top 5 per cycle

## Rate Limiting

| Action   | Limit        | Tracking          |
|----------|--------------|-------------------|
| Posts    | 5-10/day     | posterState.postsToday |
| Comments | 15/day       | posterState.commentsToday |
| Votes    | Unlimited    | API handles dupes |

## State Persistence

State is saved to `memory/poster-state.json`:
```json
{
  "lastPost": "2024-01-15T10:30:00Z",
  "lastComment": "2024-01-15T10:35:00Z",
  "postsToday": 3,
  "commentsToday": 8,
  "lastReset": "Mon Jan 15 2024",
  "commentedPostIds": [123, 456, 789],
  "postedTopics": ["Multi-Platform...", "On-Chain..."]
}
```

## Admin Notifications

When a post is created successfully, the super admin receives a Telegram notification:
- Post title
- Tags
- Link to forum

## Post Content

AI-generated posts cover topics like:
- Multi-platform arbitrage detection
- Market matching with named entity extraction
- On-chain prediction verification
- Multi-agent system architecture
- API aggregation lessons
- Brier score calibration

10 fallback posts are available when AI is unavailable.

## Trigger Methods

1. **Manual**: `/poster post`, `/poster cycle` commands via Telegram
2. **Heartbeat**: Every 3 minutes via PM2 ecosystem.config.js
3. **CLI**: `npx ts-node skills/agentPoster.ts loop 180`

## Skill Files

- `skills/agentPoster.ts` - Main poster logic
- `skills/colosseumAgent.ts` - Colosseum API wrapper
- `memory/poster-state.json` - State persistence

## Response Format

```
## Agent-Poster Cycle Complete

**Time:** 2024-01-15T10:30:00Z

- Status: active | Time: 2h 30m remaining
- Created post: "Cross-Platform Arbitrage Detection..."
- Engaged: 3 actions
- Voted: 5 projects

**Stats:**
- Posts today: 3/5
- Comments today: 8/15
```
