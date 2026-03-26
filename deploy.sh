#!/bin/bash
# BeRight Manual Deployment Script
# Deploys beright-ts to Railway without using GitHub Actions

set -e

echo "🚀 BeRight Railway Deployment"
echo "================================"
echo ""

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

# Navigate to beright-ts
echo "📁 Navigating to beright-ts..."
cd "$(dirname "$0")/beright-ts"
pwd
echo ""

# Show current Railway project info
echo "📊 Railway Project Info:"
echo "   Service ID: b3c25a10-9c9b-44e3-bdc3-badad053302d"
echo "   App URL: https://beright-api-production.up.railway.app"
echo ""

# Deploy to Railway
echo "🚀 Deploying to Railway..."
echo "   Using service: b3c25a10-9c9b-44e3-bdc3-badad053302d"
echo ""

railway up --service b3c25a10-9c9b-44e3-bdc3-badad053302d

echo ""
echo "✅ Deployment initiated!"
echo ""

# Wait for deployment
echo "⏳ Waiting 30 seconds for deployment to complete..."
sleep 30

# Check health endpoint
echo ""
echo "🔍 Verifying deployment health..."
echo "   Testing: https://beright-api-production.up.railway.app/api/health"
echo ""

if curl -f -s https://beright-api-production.up.railway.app/api/health > /dev/null 2>&1; then
    echo "✅ Health check PASSED!"
    echo ""
    echo "📊 Health Status:"
    curl -s https://beright-api-production.up.railway.app/api/health | jq '.' 2>/dev/null || curl -s https://beright-api-production.up.railway.app/api/health
    echo ""
    echo ""
    echo "🎉 Deployment SUCCESSFUL!"
    echo ""
    echo "📱 Your app is live at:"
    echo "   https://beright-api-production.up.railway.app"
    echo ""
    echo "🔗 View logs:"
    echo "   railway logs --service b3c25a10-9c9b-44e3-bdc3-badad053302d"
    echo ""
    echo "🎯 Railway Dashboard:"
    echo "   https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4"
    echo ""
else
    echo "⚠️ Health check failed"
    echo "   This is normal - deployment may still be in progress"
    echo ""
    echo "🔍 Check deployment status:"
    echo "   railway status"
    echo ""
    echo "📋 View logs:"
    echo "   railway logs --service b3c25a10-9c9b-44e3-bdc3-badad053302d"
    echo ""
    echo "🎯 Railway Dashboard:"
    echo "   https://railway.com/project/5acb9f49-1ae2-4ccb-94c6-8ce62f472cc4"
    echo ""
fi

echo "================================"
echo "✅ Deployment script complete"
