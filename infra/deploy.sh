#!/bin/bash

# Rift Rewind v2 - Backend Deployment Script
# This script builds and deploys the AWS SAM backend

set -e  # Exit on error

echo "================================"
echo "Rift Rewind Backend Deployment"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "template.yaml" ]; then
    echo -e "${RED}Error: template.yaml not found. Please run this script from the infra/ directory.${NC}"
    exit 1
fi

# Check if secret.json exists
if [ ! -f "secret.json" ]; then
    echo -e "${YELLOW}Warning: secret.json not found.${NC}"
    echo "Please create secret.json with your Riot API key:"
    echo '{ "RIOT_API_KEY": "RGAPI-your-key-here" }'
    exit 1
fi

echo -e "${GREEN}✓${NC} Found secret.json"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} AWS CLI found"

# Check if SAM CLI is installed
if ! command -v sam &> /dev/null; then
    echo -e "${RED}Error: SAM CLI not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} SAM CLI found"
echo ""

# Build
echo "Building Lambda functions..."
sam build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}✗${NC} Build failed"
    exit 1
fi

echo ""

# Deploy
echo "Deploying to AWS..."

if [ -f "samconfig.toml" ]; then
    # Use existing config
    echo "Using existing SAM configuration..."
    sam deploy --no-confirm-changeset
else
    # First time deployment
    echo "First time deployment - will prompt for configuration..."
    sam deploy --guided
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓${NC} Deployment successful!"
    echo ""
    echo "Getting API Gateway URL..."
    API_URL=$(aws cloudformation describe-stacks \
        --stack-name rift-rewind \
        --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
        --output text 2>/dev/null || echo "Not found")
    
    if [ "$API_URL" != "Not found" ]; then
        echo -e "${GREEN}API Gateway URL:${NC} $API_URL"
        echo ""
        echo "Update this URL in your frontend:"
        echo "  frontend/src/api.ts -> const BASE_URL = '$API_URL';"
    fi
else
    echo -e "${RED}✗${NC} Deployment failed"
    exit 1
fi

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
