Param(
  [string]$Region = "eu-west-1",
  [string[]]$Stacks = @("rift-rewind-v2","rift-rewind"),
  [switch]$ForceDeleteSecret # include this switch to also delete RiotApiKey
)

Write-Host "Region:" $Region

# 1) Disable Lambda event-source mappings (triggers)
function Disable-ESM {
  param([string]$FnName)
  if ([string]::IsNullOrEmpty($FnName) -or $FnName -eq "None") { return }
  $uuids = aws lambda list-event-source-mappings --region $Region --function-name $FnName --query "EventSourceMappings[].UUID" --output text 2>$null
  if ($uuids) {
    $uuids -split "\s+" | ForEach-Object {
      if ($_) { aws lambda update-event-source-mapping --region $Region --uuid $_ --disabled | Out-Null }
    }
    Write-Host "Disabled ESM for $FnName"
  }
}

$fetchFn = aws lambda list-functions --region $Region --query "Functions[?contains(FunctionName,'rift-rewind-fetch')]|[0].FunctionName" --output text 2>$null
$procFn  = aws lambda list-functions --region $Region --query "Functions[?contains(FunctionName,'rift-rewind-process')]|[0].FunctionName" --output text 2>$null
Disable-ESM -FnName $fetchFn
Disable-ESM -FnName $procFn

# 2) Purge SQS queues from stack outputs
foreach ($S in $Stacks) {
  try {
    $fetchQ = aws cloudformation describe-stacks --region $Region --stack-name $S --query "Stacks[0].Outputs[?OutputKey=='FetchQueueUrl'].OutputValue" --output text 2>$null
    $procQ  = aws cloudformation describe-stacks --region $Region --stack-name $S --query "Stacks[0].Outputs[?OutputKey=='ProcessQueueUrl'].OutputValue" --output text 2>$null
    if ($fetchQ -and $fetchQ -ne "None") { aws sqs purge-queue --region $Region --queue-url $fetchQ }
    if ($procQ  -and $procQ  -ne "None") { aws sqs purge-queue --region $Region --queue-url $procQ  }
    if ($fetchQ -or $procQ) { Write-Host "Purged SQS for stack $S" }
  } catch {}
}

# 3) Empty data S3 bucket(s)
foreach ($S in $Stacks) {
  $bucket = aws cloudformation describe-stacks --region $Region --stack-name $S --query "Stacks[0].Outputs[?OutputKey=='DataBucketName'].OutputValue" --output text 2>$null
  if ($bucket -and $bucket -ne "None") {
    aws s3 rm "s3://$bucket" --recursive 2>$null
    Write-Host "Emptied s3://$bucket"
  }
}

# Optional: empty SAM managed bucket if present
$samBucket = "aws-sam-cli-managed-default-samclisourcebucket-j68d17tg0qml"
try { aws s3 ls "s3://$samBucket" 2>$null | Out-Null; aws s3 rm "s3://$samBucket" --recursive 2>$null; Write-Host "Emptied s3://$samBucket" } catch {}

# 4) Delete stacks
foreach ($S in $Stacks) {
  try {
    aws cloudformation describe-stacks --region $Region --stack-name $S 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      aws cloudformation delete-stack --region $Region --stack-name $S
      aws cloudformation wait stack-delete-complete --region $Region --stack-name $S
      Write-Host "Deleted stack $S"
    }
  } catch {}
}

# 5) Delete secret (optional)
if ($ForceDeleteSecret.IsPresent) {
  try {
    aws secretsmanager delete-secret --region $Region --secret-id RiotApiKey --force-delete-without-recovery
    Write-Host "Deleted secret RiotApiKey"
  } catch {}
}

# 6) Delete orphaned log groups
$logs = aws logs describe-log-groups --region $Region --log-group-name-prefix "/aws/lambda/rift-rewind" --query "logGroups[].logGroupName" --output text 2>$null
if ($logs) {
  $logs -split "\s+" | ForEach-Object {
    if ($_) { aws logs delete-log-group --region $Region --log-group-name $_ }
  }
  Write-Host "Removed orphaned log groups"
}

# 7) Final sanity checks
aws lambda list-functions --region $Region --query "Functions[?contains(FunctionName,'rift-rewind')].[FunctionName]" --output table
aws apigatewayv2 get-apis --region $Region --query "Items[?contains(Name,'rift')].[ApiId,Name]" --output table
aws dynamodb list-tables --region $Region --output text | Select-String "rift-rewind"
aws sqs list-queues --region $Region --output text | Select-String "rift-rewind"
