# Publica el mapa en GitHub Pages. Requiere `gh auth login` hecho previamente.
# Uso: powershell -ExecutionPolicy Bypass -File scripts\publicar.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$repo = 'mapa-buenos-aires'
gh auth status | Out-Null
if (-not $?) { Write-Error 'Primero ejecuta: gh auth login'; exit 1 }
$owner = gh api user --jq .login

# 1) Crear el repo remoto si no existe y subir main
# (gh escribe en stderr cuando el repo no existe; con ErrorActionPreference=Stop eso cortaría el script)
$ErrorActionPreference = 'Continue'
cmd /c "gh repo view $owner/$repo --json name >nul 2>&1"
$existe = ($LASTEXITCODE -eq 0)
$ErrorActionPreference = 'Stop'
if (-not $existe) {
  gh repo create $repo --public --source=. --remote=origin --push
} else {
  if (-not (git remote get-url origin 2>$null)) { git remote add origin "https://github.com/$owner/$repo.git" }
  git push -u origin main
}

# 2) Compilar y subir dist/ a la rama gh-pages
npm run deploy

# 3) Activar GitHub Pages sobre gh-pages (ignora el error si ya estaba activo)
try {
  gh api -X POST "repos/$owner/$repo/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' | Out-Null
} catch {
  gh api -X PUT "repos/$owner/$repo/pages" -f 'source[branch]=gh-pages' -f 'source[path]=/' | Out-Null
}

Write-Host ''
Write-Host "Listo. En uno o dos minutos el mapa queda en: https://$owner.github.io/$repo/"
