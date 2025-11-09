#!/bin/bash

# Rift Rewind v2 - Frontend Deployment Script
# This script builds and deploys the React frontend to S3

set -e  # Exit on error

echo "================================="
echo "Rift Rewind Frontend Deployment"
echo "================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}Error: package.json not found. Please run this script from the frontend/ directory.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found package.json"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Warning: node_modules not found. Running npm install...${NC}"
    npm install
fi

echo -e "${GREEN}✓${NC} Dependencies installed"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} AWS CLI found"
echo ""

# Get S3 bucket name from user or config
if [ -z "$S3_BUCKET" ]; then
    # Try to get from CloudFormation
    S3_BUCKET=$(aws cloudformation describe-stacks \
        --stack-name rift-rewind \
        --query 'Stacks[0].Outputs[?OutputKey==`FrontendBucket`].OutputValue' \
        --output text 2>/dev/null || echo "")
    
    if [ -z "$S3_BUCKET" ]; then
        echo "S3 bucket not found in CloudFormation output."
        read -p "Enter your S3 bucket name (e.g., rift-rewind-frontend-123456789): " S3_BUCKET
        
        if [ -z "$S3_BUCKET" ]; then
            echo -e "${RED}Error: S3 bucket name is required${NC}"
            exit 1
        fi
    fi
fi

echo "Target S3 bucket: $S3_BUCKET"
echo ""

# Get AWS region
REGION=$(aws configure get region || echo "eu-west-1")
echo "AWS Region: $REGION"
echo ""

# Build
echo "Building frontend..."
npm run build

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Build successful"
else
    echo -e "${RED}✗${NC} Build failed"
    exit 1
fi

echo ""

# Deploy to S3
echo "Deploying to S3..."
aws s3 sync dist/ s3://$S3_BUCKET --delete --region $REGION

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Deployment successful!"
    echo ""
    echo "Website URL: http://$S3_BUCKET.s3-website-$REGION.amazonaws.com"
else
    echo -e "${RED}✗${NC} Deployment failed"
    exit 1
fi

echo ""
echo "================================="
echo "Deployment Complete!"
echo "================================="
