# Claude Code Setup Guide for BeRight

Complete guide for your technical co-founder to set up Claude Code for maximum productivity.

## Quick Start

```bash
# 1. Navigate to project
cd /Users/shivamsoni/Desktop/beright

# 2. Start Claude Code
claude

# 3. Run initialization (regenerates CLAUDE.md if needed)
/init
```

## Directory Structure

```
.claude/
├── settings.local.json   # Permissions, hooks, env vars
├── SETUP_GUIDE.md        # This file
├── mcp-config.md         # MCP server documentation
├── rules/                # Conditional rules by file pattern
│   ├── api-routes.md
│   ├── solana-onchain.md
│   ├── execution.md
│   ├── agents.md
│   ├── data-fabric.md
│   ├── testing.md
│   └── typescript.md
├── agents/               # Subagent definitions
│   ├── scout.md
│   ├── analyst.md
│   ├── trader.md
│   ├── xdegen.md
│   ├── researcher.md
│   ├── deployer.md
│   └── tester.md
├── commands/             # Custom slash commands
│   ├── typecheck.md
│   ├── build.md
│   ├── deploy.md
│   ├── test-apis.md
│   ├── arb.md
│   ├── markets.md
│   ├── pr.md
│   ├── status.md
│   ├── brief.md
│   └── calibrate.md
└── skills/               # Reusable workflows
    ├── spec.md
    ├── review.md
    ├── debug.md
    ├── deploy.md
    ├── api-integration.md
    ├── feature-development.md
    ├── bug-fix.md
    ├── pr-review.md
    ├── solana-development.md
    ├── release.md
    └── agent-development.md
```

## Features Configured

### 1. Safety Hooks (Automatic Protection)

The hooks in `settings.local.json` provide:

| Hook | Protection |
|------|------------|
| PreToolUse (Edit/Write) | Blocks edits to `lib/onchain/`, `lib/execution/`, `staking-pool/` |
| PreToolUse (Bash) | Blocks mainnet deployments |
| PostToolUse | Logs all actions to `/tmp/claude-beright-audit.log` |

### 2. Modular Rules (Context-Aware)

Rules automatically apply based on file paths:

| Rule File | Applies To |
|-----------|------------|
| `api-routes.md` | `beright-ts/app/api/**/*.ts` |
| `solana-onchain.md` | `lib/onchain/`, `staking-pool/` |
| `execution.md` | `lib/execution/`, `lib/kalshi/` |
| `agents.md` | `beright-ts/agents/**/*.ts` |
| `data-fabric.md` | `lib/dataFabric/` |
| `typescript.md` | All `.ts` files |

### 3. Subagents (Specialized Workers)

Spawn focused agents for specific tasks:

| Agent | Use Case | Speed |
|-------|----------|-------|
| Scout | Arb detection, trends | Fast (2s) |
| Analyst | Deep research, probabilities | Slow (15s) |
| Trader | Risk, sizing, execution | Medium (3s) |
| xDegen | Social content | Medium (5s) |
| Researcher | Code exploration | Slow (30s) |
| Deployer | Railway deployments | Slow (60s) |
| Tester | Run tests, verify | Slow (120s) |

**Usage**:
```
"Use the scout agent to find arbitrage opportunities"
"Spawn an analyst to research this market deeply"
"Run 3 explore agents in parallel to find all usages of fetchMarkets"
```

### 4. Custom Commands

| Command | Description |
|---------|-------------|
| `/typecheck` | Run TypeScript type checking |
| `/build` | Build the Next.js application |
| `/deploy` | Deploy to Railway production |
| `/test-apis` | Test all API endpoints |
| `/arb` | Scan for arbitrage opportunities |
| `/markets [query]` | Search prediction markets |
| `/pr` | Create a pull request |
| `/status` | Show project status |
| `/brief` | Generate morning market brief |
| `/calibrate` | Run calibration analysis |

### 5. Skills (Workflows)

Invoke skills for complex workflows:

| Skill | Use Case |
|-------|----------|
| `spec` | Write specification before coding |
| `review` | Code review checklist |
| `debug` | Systematic debugging |
| `deploy` | Full deployment workflow |
| `feature-development` | End-to-end feature building |
| `bug-fix` | Bug fixing process |
| `pr-review` | PR review checklist |
| `solana-development` | On-chain code guidelines |
| `release` | Version release workflow |

## Daily Workflow

### Morning Startup
```bash
# Start Claude Code
claude

# Check project status
/status

# Get morning brief
/brief
```

### Development Session
```bash
# Start with a task
"Help me implement [feature]"

# Claude will:
# 1. Enter plan mode for complex tasks
# 2. Use TodoWrite to track progress
# 3. Follow the relevant rules automatically
# 4. Use subagents for research
# 5. Run typecheck before committing
```

### Before Ending
```bash
# Verify everything works
/typecheck
/build

# Commit if needed
"Commit the changes"

# Deploy if ready
/deploy
```

## Session Management

### Named Sessions
```bash
# Start a named session
claude --session forecaster-network

# Resume later
claude --resume forecaster-network
```

### Background Agents
```bash
# Run long tasks in background
"Run the tester agent in the background to verify all endpoints"

# Check on it later
"What's the status of the background test?"
```

## Context Management

### Check Context Usage
```
/context
```

### Reference Directories
```
@beright-ts/agents/      # Reference all agent code
@beright-ts/lib/         # Reference all lib code
```

### Clean Context
Start a fresh session for unrelated tasks:
```bash
claude --new
```

## Troubleshooting

### Hooks Blocking Operations
If you need to edit a protected file:
1. Understand why the hook blocked it
2. Explicitly approve the operation
3. The hook will ask for confirmation

### MCP Not Working
```bash
# Check MCP status
/mcp list

# Reinstall if needed
/mcp install [server-name]
```

### Permissions Issues
Check `settings.local.json` and add new permissions as needed.

## Best Practices

1. **Use Todo Lists**: Claude tracks progress with TodoWrite
2. **Spec First**: Use `/spec` skill for 3+ step tasks
3. **Small Commits**: Commit after each working milestone
4. **Subagents for Research**: Keep main context clean
5. **Verify Before Done**: Always run `/typecheck` and `/build`
6. **Update Lessons**: Add to `docs/lessons.md` after learning something

## MCP Servers (External Integrations)

5 MCP servers are configured in `mcp-servers.json`:

| Server | Purpose | Env Var |
|--------|---------|---------|
| **GitHub** | PRs, issues, CI/CD | `GITHUB_TOKEN` |
| **Neon** | Database queries, migrations | `NEON_API_KEY` |
| **Supabase** | Auth, real-time, storage | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Vercel** | Deployments, logs, domains | `VERCEL_TOKEN` |
| **Filesystem** | Enhanced file operations | (none) |

### Using MCP Servers
```
@mcp:github    # Enable GitHub integration
@mcp:neon      # Enable database access
@mcp:supabase  # Enable Supabase
@mcp:vercel    # Enable Vercel

/mcp list      # See all available servers
```

### Example Workflows
```
"Create a PR for my changes"           # @mcp:github
"Query the last 10 predictions"         # @mcp:neon
"Check the Vercel deployment status"    # @mcp:vercel
"Show users who signed up today"        # @mcp:supabase
```

See `mcp-config.md` for full documentation.

---

## Environment Variables

Ensure these are set in your shell (`~/.zshrc`):

```bash
# Required for Claude Code
export ANTHROPIC_API_KEY="sk-..."

# MCP Servers
export GITHUB_TOKEN="ghp_..."
export NEON_API_KEY="neon_..."
export SUPABASE_URL="https://xxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ..."
export VERCEL_TOKEN="..."

# For prediction markets
export POLYMARKET_API_KEY="..."
export KALSHI_API_KEY="..."

# For Solana
export SOLANA_RPC_URL="https://..."
export HELIUS_API_KEY="..."

# For Railway (if using instead of Vercel)
export RAILWAY_TOKEN="..."
```

## Getting Help

```
/help                    # Claude Code help
/context                 # Check context usage
cat docs/ARCHITECTURE.md # System architecture
cat docs/APIS.md         # API reference
```
