#!/bin/bash
# BeRight Manual Deployment Script
# Deploys beright-ts to Railway without using GitHub Actions

set -e

echo "🚀 BeRight Railway Deployment"
echo "================================"
echo ""

RAILWAY_PROJECT_ID="135d365f-e8bf-469c-a022-9a3a944c38ea"
RAILWAY_SERVICE_ID="${RAILWAY_SERVICE_ID:-}"
RAILWAY_APP_URL="${RAILWAY_APP_URL:-}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found"
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
    echo "✅ Railway CLI installed"
    echo ""
fi

# Check Railway login status
echo "🔐 Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    echo "❌ Not logged in to Railway"
    echo "🔑 Opening browser for authentication..."
    railway login
    echo "✅ Logged in to Railway"
else
    echo "✅ Already logged in to Railway"
fi
echo ""

# Ensure required config is present
if [ -z "$RAILWAY_SERVICE_ID" ]; then
    echo "❌ Missing Railway config: RAILWAY_SERVICE_ID"
    echo ""
    echo "Set it to your Railway service UUID, e.g.:"
    echo "  export RAILWAY_SERVICE_ID=\"<your-service-id>\""
    echo ""
    echo "Optional (for health check output):"
    echo "  export RAILWAY_APP_URL=\"https://<your-app>.up.railway.app\""
    exit 1
fi

# Navigate to beright-ts
echo "📁 Navigating to beright-ts..."
cd "$(dirname "$0")/beright-ts"
pwd
echo ""

# Show current Railway project info
echo "📊 Railway Project Info:"
echo "   Project ID: $RAILWAY_PROJECT_ID"
echo "   Service ID: $RAILWAY_SERVICE_ID"
if [ -n "$RAILWAY_APP_URL" ]; then
    echo "   App URL: $RAILWAY_APP_URL"
else
    echo "   App URL: (not set)"
fi
echo ""

# Deploy to Railway
echo "🚀 Deploying to Railway..."
echo "   Using service: $RAILWAY_SERVICE_ID"
echo ""

railway up --service "$RAILWAY_SERVICE_ID"

echo ""
echo "✅ Deployment initiated!"
echo ""

# Wait for deployment
echo "⏳ Waiting 30 seconds for deployment to complete..."
sleep 30

# Check health endpoint
echo ""
echo "🔍 Verifying deployment health..."
if [ -n "$RAILWAY_APP_URL" ]; then
    echo "   Testing: $RAILWAY_APP_URL/api/health"
else
    echo "   Skipping health check (RAILWAY_APP_URL not set)"
fi
echo ""

if [ -n "$RAILWAY_APP_URL" ] && curl -f -s "$RAILWAY_APP_URL/api/health" > /dev/null 2>&1; then
    echo "✅ Health check PASSED!"
    echo ""
    echo "📊 Health Status:"
    curl -s "$RAILWAY_APP_URL/api/health" | jq '.' 2>/dev/null || curl -s "$RAILWAY_APP_URL/api/health"
    echo ""
    echo ""
    echo "🎉 Deployment SUCCESSFUL!"
    echo ""
    echo "📱 Your app is live at:"
    if [ -n "$RAILWAY_APP_URL" ]; then
        echo "   $RAILWAY_APP_URL"
    else
        echo "   (set RAILWAY_APP_URL to print the live URL)"
    fi
    echo ""
    echo "🔗 View logs:"
    echo "   railway logs --service $RAILWAY_SERVICE_ID"
    echo ""
    echo "🎯 Railway Dashboard:"
    echo "   https://railway.com/project/$RAILWAY_PROJECT_ID"
    echo ""
else
    echo "⚠️ Health check failed (or skipped)"
    echo "   Deployment may still be in progress"
    echo ""
    echo "🔍 Check deployment status:"
    echo "   railway status"
    echo ""
    echo "📋 View logs:"
    echo "   railway logs --service $RAILWAY_SERVICE_ID"
    echo ""
    echo "🎯 Railway Dashboard:"
    echo "   https://railway.com/project/$RAILWAY_PROJECT_ID"
    echo ""
fi

echo "================================"
echo "✅ Deployment script complete"
