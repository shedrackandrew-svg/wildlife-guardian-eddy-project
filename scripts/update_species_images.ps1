$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$catalogPath = Join-Path $repoRoot 'app/static/wildlife-catalog.json'
$rows = Get-Content $catalogPath -Raw | ConvertFrom-Json

foreach ($row in $rows) {
  $name = if ($row.species_name) { [string]$row.species_name } elseif ($row.common_name) { [string]$row.common_name } else { 'wildlife' }
  $slug = ($name.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  if ([string]::IsNullOrWhiteSpace($slug)) { $slug = 'wildlife' }

  $folder = Join-Path (Join-Path $repoRoot 'app/static/images/species') $slug
  New-Item -ItemType Directory -Force -Path $folder | Out-Null

  $jpg = Join-Path $folder 'cover.jpg'
  $svg = Join-Path $folder 'cover.svg'
  if (-not (Test-Path $jpg) -and -not (Test-Path $svg)) {
    $safeTitle = [System.Security.SecurityElement]::Escape($name)
    $svgText = @"
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 800' role='img' aria-label='$safeTitle'>
  <defs>
    <linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0%' stop-color='#e8f5ec'/>
      <stop offset='100%' stop-color='#89caa0'/>
    </linearGradient>
  </defs>
  <rect width='1200' height='800' fill='url(#g)'/>
  <rect x='100' y='230' width='1000' height='340' rx='28' fill='rgba(20,65,40,0.15)'/>
  <text x='600' y='410' text-anchor='middle' font-family='Manrope,Arial,sans-serif' font-size='54' fill='#1f4d33'>$safeTitle</text>
  <text x='600' y='470' text-anchor='middle' font-family='Manrope,Arial,sans-serif' font-size='24' fill='#2c6142'>Local species image folder</text>
</svg>
"@
    [System.IO.File]::WriteAllText((Join-Path $folder 'cover.svg'), $svgText, (New-Object System.Text.UTF8Encoding($false)))
  }

  $localImage = if (Test-Path $jpg) { "/static/images/species/$slug/cover.jpg" } else { "/static/images/species/$slug/cover.svg" }
  $row.image_url = $localImage
  $row.gallery_images = @($localImage, $localImage, $localImage)
}

$json = $rows | ConvertTo-Json -Depth 12
[System.IO.File]::WriteAllText($catalogPath, $json, (New-Object System.Text.UTF8Encoding($false)))

$folderCount = (Get-ChildItem (Join-Path $repoRoot 'app/static/images/species') -Directory | Measure-Object).Count
Write-Output ("Catalog rows updated: " + $rows.Count)
Write-Output ("Species folders present: " + $folderCount)
Write-Output "Sample image_url values:"
$rows | Select-Object -First 3 | ForEach-Object { Write-Output (" - " + $_.species_name + ": " + $_.image_url) }
$rows | Select-Object -Last 3 | ForEach-Object { Write-Output (" - " + $_.species_name + ": " + $_.image_url) }
