# Rift Rewind v2 - Backend Deployment Script (PowerShell)
# This script builds and deploys the AWS SAM backend

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Rift Rewind Backend Deployment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "template.yaml")) {
    Write-Host "Error: template.yaml not found. Please run this script from the infra/ directory." -ForegroundColor Red
    exit 1
}

# Check if secret.json exists
if (-not (Test-Path "secret.json")) {
    Write-Host "Warning: secret.json not found." -ForegroundColor Yellow
    Write-Host 'Please create secret.json with your Riot API key:'
    Write-Host '{ "RIOT_API_KEY": "RGAPI-your-key-here" }'
    exit 1
}

Write-Host "✓ Found secret.json" -ForegroundColor Green

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✓ AWS CLI found" -ForegroundColor Green
} catch {
    Write-Host "Error: AWS CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

# Check if SAM CLI is installed
try {
    sam --version | Out-Null
    Write-Host "✓ SAM CLI found" -ForegroundColor Green
} catch {
    Write-Host "Error: SAM CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Build
Write-Host "Building Lambda functions..." -ForegroundColor Cyan
sam build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Deploy
Write-Host "Deploying to AWS..." -ForegroundColor Cyan

if (Test-Path "samconfig.toml") {
    # Use existing config
    Write-Host "Using existing SAM configuration..."
    sam deploy --no-confirm-changeset
} else {
    # First time deployment
    Write-Host "First time deployment - will prompt for configuration..."
    sam deploy --guided
}

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Getting API Gateway URL..."
    
    try {
        $ApiUrl = aws cloudformation describe-stacks `
            --stack-name rift-rewind `
            --query 'Stacks[0].Outputs[?OutputKey==``ApiUrl``].OutputValue' `
            --output text 2>$null
        
        if ($ApiUrl) {
            Write-Host "API Gateway URL: " -NoNewline -ForegroundColor Green
            Write-Host $ApiUrl
            Write-Host ""
            Write-Host "Update this URL in your frontend:"
            Write-Host "  frontend/src/api.ts -> const BASE_URL = '$ApiUrl';"
        }
    } catch {
        Write-Host "Could not retrieve API URL from CloudFormation" -ForegroundColor Yellow
    }
} else {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
