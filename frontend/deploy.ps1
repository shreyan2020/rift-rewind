# Rift Rewind v2 - Frontend Deployment Script (PowerShell)
# This script builds and deploys the React frontend to S3

$ErrorActionPreference = "Stop"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Rift Rewind Frontend Deployment" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "Error: package.json not found. Please run this script from the frontend/ directory." -ForegroundColor Red
    exit 1
}

Write-Host "✓ Found package.json" -ForegroundColor Green

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Warning: node_modules not found. Running npm install..." -ForegroundColor Yellow
    npm install
}

Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Check if AWS CLI is installed
try {
    aws --version | Out-Null
    Write-Host "✓ AWS CLI found" -ForegroundColor Green
} catch {
    Write-Host "Error: AWS CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Get S3 bucket name from environment or user
$S3Bucket = $env:S3_BUCKET

if (-not $S3Bucket) {
    # Try to get from CloudFormation
    try {
        $S3Bucket = aws cloudformation describe-stacks `
            --stack-name rift-rewind `
            --query 'Stacks[0].Outputs[?OutputKey==``FrontendBucket``].OutputValue' `
            --output text 2>$null
    } catch {
        # Ignore error
    }
    
    if (-not $S3Bucket -or $S3Bucket -eq "") {
        Write-Host "S3 bucket not found in CloudFormation output."
        $S3Bucket = Read-Host "Enter your S3 bucket name (e.g., rift-rewind-frontend-123456789)"
        
        if (-not $S3Bucket) {
            Write-Host "Error: S3 bucket name is required" -ForegroundColor Red
            exit 1
        }
    }
}

Write-Host "Target S3 bucket: $S3Bucket"
Write-Host ""

# Get AWS region
try {
    $Region = aws configure get region
    if (-not $Region) { $Region = "eu-west-1" }
} catch {
    $Region = "eu-west-1"
}

Write-Host "AWS Region: $Region"
Write-Host ""

# Build
Write-Host "Building frontend..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Build successful" -ForegroundColor Green
} else {
    Write-Host "✗ Build failed" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Deploy to S3
Write-Host "Deploying to S3..." -ForegroundColor Cyan
aws s3 sync dist/ s3://$S3Bucket --delete --region $Region

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Website URL: http://$S3Bucket.s3-website-$Region.amazonaws.com"
} else {
    Write-Host "✗ Deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Deployment Complete!" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
