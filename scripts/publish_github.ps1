param(
    [string]$Message = "Deploy-ready update"
)

$ErrorActionPreference = "Stop"

Write-Host "Checking git status..."

git add -A

git commit -m $Message

git push origin HEAD

Write-Host "Pushed to GitHub."
Write-Host "Deploy on Render with: https://render.com/deploy?repo=https://github.com/shedrackandrew-svg/wildlife-guardian-eddy-project"
