# MCP Server Configuration for BeRight

MCP (Model Context Protocol) servers extend Claude Code's capabilities by connecting to external services. This project has 5 MCP servers configured.

## Configured MCP Servers

### 1. GitHub MCP (@mcp:github)

**Package**: `@modelcontextprotocol/server-github`

**Purpose**: Full GitHub integration for the BeRight repository

**Capabilities**:
- Create, review, and merge pull requests
- Manage issues and labels
- View commit history and diffs
- Check CI/CD workflow status
- Manage releases and tags
- Search code across repositories

**Usage Examples**:
```
"Create a PR for my current changes"
"What's the status of CI on the main branch?"
"Show me open issues labeled 'bug'"
"Review PR #123"
```

**Required Env Var**:
```bash
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
```

**Token Permissions Needed**:
- `repo` (full repository access)
- `workflow` (GitHub Actions)
- `read:org` (if using org repos)

---

### 2. Neon MCP (@mcp:neon)

**Package**: `@neondatabase/mcp-server-neon`

**Purpose**: Direct Postgres database access for BeRight data

**Capabilities**:
- Run SQL queries directly
- Create and manage branches
- View table schemas
- Manage database migrations
- Query predictions, leaderboard, calibration data

**Usage Examples**:
```
"Show me the last 10 predictions"
"What's the average Brier score for user X?"
"Query the leaderboard for top forecasters"
"Create a new database branch for testing"
```

**Required Env Var**:
```bash
export NEON_API_KEY="neon_xxxxxxxxxxxxxxxxxxxx"
```

**BeRight Tables**:
- `predictions` - User predictions
- `calibration_scores` - Brier scores
- `leaderboard` - Forecaster rankings
- `markets` - Cached market data
- `users` - User profiles

---

### 3. Supabase MCP (@mcp:supabase)

**Package**: `@supabase/mcp-server-supabase`

**Purpose**: Supabase backend for user auth, real-time, and storage

**Capabilities**:
- Query Supabase tables
- Manage authentication
- Access storage buckets
- Real-time subscriptions setup
- Edge function management

**Usage Examples**:
```
"Query all users who signed up this week"
"Check the auth configuration"
"List files in the avatars bucket"
"Show me the RLS policies on predictions table"
```

**Required Env Vars**:
```bash
export SUPABASE_URL="https://xxxx.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJxxxxxxxxxxxx"
```

**Security Note**: Service role key bypasses RLS. Use carefully.

---

### 4. Vercel MCP (@mcp:vercel)

**Package**: `@vercel/mcp-server-vercel`

**Purpose**: Vercel deployment and project management

**Capabilities**:
- View deployment status and logs
- Manage environment variables
- Rollback deployments
- Check build outputs
- Manage domains
- View analytics

**Usage Examples**:
```
"What's the latest deployment status?"
"Show me the deployment logs for the last build"
"Rollback to the previous deployment"
"List all environment variables"
"Check domain configuration"
```

**Required Env Var**:
```bash
export VERCEL_TOKEN="xxxxxxxxxxxxxxxxxxxx"
```

**Get Token**: https://vercel.com/account/tokens

---

### 5. Filesystem MCP (@mcp:filesystem)

**Package**: `@modelcontextprotocol/server-filesystem`

**Purpose**: Enhanced file system operations

**Capabilities**:
- Advanced file search
- Bulk file operations
- Directory tree visualization
- File watching

**Already configured** for `/Users/shivamsoni/Desktop/beright`

---

## Installation

### Option 1: Global Claude Code Config

Copy the MCP config to your global Claude settings:

```bash
# Create Claude config directory if needed
mkdir -p ~/.claude

# Copy MCP servers config
cp .claude/mcp-servers.json ~/.claude/mcp-servers.json
```

### Option 2: Project-Level Config

The `mcp-servers.json` in this `.claude/` directory will be used automatically when running Claude Code from this project.

---

## Environment Variables Setup

Add these to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
# GitHub - for PR management, issues, CI/CD
export GITHUB_TOKEN="ghp_your_token_here"

# Neon - for database access
export NEON_API_KEY="neon_your_api_key_here"

# Supabase - for backend access
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJ_your_service_key_here"

# Vercel - for deployment management
export VERCEL_TOKEN="your_vercel_token_here"
```

Then reload:
```bash
source ~/.zshrc
```

---

## Using MCP Servers in Claude Code

### Enable a Server
```
@mcp:github    # Enable GitHub
@mcp:neon      # Enable Neon
@mcp:supabase  # Enable Supabase
@mcp:vercel    # Enable Vercel
```

### Check Available Servers
```
/mcp list
```

### Example Workflows

**Deploy and Verify**:
```
"Deploy to Vercel and check the deployment status"
# Uses: @mcp:vercel
```

**Create PR with Database Migration**:
```
"Create a migration to add a new column, then create a PR"
# Uses: @mcp:neon, @mcp:github
```

**Debug Production Issue**:
```
"Check the Vercel logs for errors, then query the database for related data"
# Uses: @mcp:vercel, @mcp:neon
```

**Full Release Flow**:
```
"Create a release: check CI status, merge PRs, deploy to Vercel, verify database"
# Uses: @mcp:github, @mcp:vercel, @mcp:neon
```

---

## BeRight-Specific Use Cases

### Prediction Markets
```sql
-- Query via @mcp:neon
SELECT market_id, question, probability, volume
FROM markets
WHERE platform = 'polymarket'
ORDER BY volume DESC
LIMIT 10;
```

### Leaderboard
```sql
-- Query via @mcp:neon
SELECT user_id, brier_score, total_predictions, rank
FROM leaderboard
ORDER BY brier_score ASC
LIMIT 20;
```

### User Analytics
```sql
-- Query via @mcp:supabase
SELECT
  DATE_TRUNC('day', created_at) as day,
  COUNT(*) as signups
FROM auth.users
GROUP BY day
ORDER BY day DESC;
```

### Deployment History
```
"Show me the last 5 Vercel deployments with their status"
# Uses: @mcp:vercel
```

---

## Security Best Practices

1. **Never commit tokens** - Use environment variables
2. **Minimal permissions** - Only grant required scopes
3. **Rotate regularly** - Change tokens every 90 days
4. **Audit access** - Review MCP server logs
5. **Service role caution** - Supabase service key bypasses RLS

---

## Troubleshooting

### MCP Server Not Connecting
```bash
# Check if npx can find the package
npx -y @modelcontextprotocol/server-github --version

# Verify env vars are set
echo $GITHUB_TOKEN
echo $NEON_API_KEY
```

### Permission Denied
- Check token permissions match requirements above
- Verify token hasn't expired
- Ensure you have access to the resource

### Slow Responses
- MCP servers run as subprocesses
- First call may be slow (npm package download)
- Subsequent calls are faster
