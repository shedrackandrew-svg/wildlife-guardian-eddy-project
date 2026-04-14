Param(
  [string]$RepoName = "wildlife-guardian",
  [string]$Visibility = "public"
)

Set-Location "$PSScriptRoot/.."

Write-Host "Checking GitHub auth..."
$authOk = $true
try {
  gh auth status | Out-Null
} catch {
  $authOk = $false
}

if (-not $authOk) {
  Write-Host "Not logged in. Starting GitHub login..."
  gh auth login
}

Write-Host "Creating or updating remote repo..."
try {
  gh repo create $RepoName --$Visibility --source . --remote origin --push
} catch {
  Write-Host "Repo may already exist, trying normal push..."
  git branch -M main
  git push -u origin main
}

Write-Host "Done. Now connect the repo on Render and deploy."
