# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — ComfyUI'ı bu bilgisayara kurar ve arka planda çalıştırır (yerel, bulut değil).
# Kullanım: powershell -ExecutionPolicy Bypass -File setup_native.ps1 -Step <adım> -Root <klasör> [-Port 8188]
#   env     : uv ile Python 3.12 sanal ortamı + CUDA'lı PyTorch
#   clone   : ComfyUI deposu (günceller)
#   deps    : ComfyUI ve ComfyUI-Manager bağımlılıkları
#   start   : sunucuyu arka planda başlatır (yalnızca 127.0.0.1)
#   stop    : sunucuyu durdurur
#   logs    : son günlük satırları
#   status  : JSON durum
param(
  [Parameter(Mandatory = $true)][string]$Step,
  [Parameter(Mandatory = $true)][string]$Root,
  [int]$Port = 8188
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Log($m) { Write-Output "[forge] $m" }

$Venv = Join-Path $Root 'venv'
$Py = Join-Path $Venv 'Scripts\python.exe'
$Repo = Join-Path $Root 'ComfyUI'
$LogFile = Join-Path $Root 'server.log'
New-Item -ItemType Directory -Force -Path $Root | Out-Null

function Find-Uv {
  $c = Get-Command uv -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $local = Join-Path $env:USERPROFILE '.local\bin\uv.exe'
  if (Test-Path $local) { return $local }
  Log 'uv kuruluyor…'
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  return $local
}

# Bu klasördeki ComfyUI'ın python süreçleri (başka ComfyUI kurulumlarına dokunmaz)
function Get-Server {
  $main = (Join-Path $Repo 'main.py').ToLower()
  Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Contains($main) }
}

switch ($Step) {
  'env' {
    $uv = Find-Uv
    if (-not (Test-Path $Py)) {
      Log 'Python 3.12 sanal ortamı oluşturuluyor…'
      & $uv venv --python 3.12 $Venv | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'Python ortamı oluşturulamadı' }
    }
    $hasTorch = & $Py -c "import importlib.util,sys; sys.stdout.write('1' if importlib.util.find_spec('torch') else '0')"
    if ($hasTorch -ne '1') {
      Log 'PyTorch (CUDA 13.0) indiriliyor — ~3 GB, önbellekte varsa çok daha hızlı…'
      & $uv pip install --python $Py torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130
      if ($LASTEXITCODE -ne 0) { throw 'PyTorch kurulamadı' }
    }
    $cuda = & $Py -c "import torch; print(torch.__version__, '| CUDA:', torch.cuda.is_available(), '|', torch.cuda.get_device_name(0) if torch.cuda.is_available() else '-')"
    Log "PyTorch hazır — $cuda"
  }
  'clone' {
    # git ilerlemeyi stderr'e yazar; PowerShell 5.1 bunu 'Stop' altında hata sayıp klonu yarıda keser.
    $ErrorActionPreference = 'Continue'
    if ((Test-Path $Repo) -and -not (Test-Path (Join-Path $Repo 'main.py'))) {
      Log 'Yarım kalmış indirme temizleniyor…'
      Remove-Item -Recurse -Force $Repo
    }
    if (-not (Test-Path $Repo)) {
      Log 'ComfyUI indiriliyor…'
      & git clone --quiet --depth 1 https://github.com/comfyanonymous/ComfyUI.git $Repo
      if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $Repo 'main.py'))) { throw 'git clone başarısız (git kurulu mu, internet var mı?)' }
    } else {
      Log 'ComfyUI güncelleniyor…'
      & git -C $Repo pull --quiet --ff-only
      if ($LASTEXITCODE -ne 0) { Log 'UYARI: güncellenemedi, mevcut sürümle devam' }
    }
    $ver = & git -C $Repo log -1 --format='%h %cs'
    Log "depo hazır: $Repo ($ver)"
  }
  'deps' {
    $uv = Find-Uv
    Log 'ComfyUI bağımlılıkları kuruluyor…'
    & $uv pip install --python $Py -r (Join-Path $Repo 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'ComfyUI bağımlılıkları kurulamadı' }
    $mgr = Join-Path $Repo 'manager_requirements.txt'
    if (Test-Path $mgr) {
      Log 'ComfyUI-Manager (custom node yükleyici) kuruluyor…'
      & $uv pip install --python $Py -r $mgr
      if ($LASTEXITCODE -ne 0) { Log 'UYARI: ComfyUI-Manager kurulamadı (isteğe bağlı)' }
    }
    & $Py -c "import torch, yaml, aiohttp; print('bağımlılıklar tamam')"
  }
  'start' {
    if (Get-Server) { Log 'ComfyUI zaten çalışıyor'; break }
    $argList = @("`"$(Join-Path $Repo 'main.py')`"", '--listen', '127.0.0.1', '--port', $Port, '--disable-auto-launch')
    if (Test-Path (Join-Path $Repo 'manager_requirements.txt')) { $argList += '--enable-manager' }
    $env:PYTHONUTF8 = '1'
    Start-Process -FilePath $Py -ArgumentList $argList -WorkingDirectory $Repo -WindowStyle Hidden `
      -RedirectStandardOutput $LogFile -RedirectStandardError ($LogFile + '.err')
    Log "ComfyUI başlatıldı: http://127.0.0.1:$Port (ilk açılış bir dakika sürebilir)"
  }
  'stop' {
    Get-Server | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Log 'ComfyUI durduruldu'
  }
  'logs' {
    foreach ($f in @($LogFile, ($LogFile + '.err'))) { if (Test-Path $f) { Get-Content $f -Tail 40 } }
  }
  'status' {
    $o = [ordered]@{
      venv    = (Test-Path $Py)
      torch   = $false
      cloned  = (Test-Path (Join-Path $Repo 'main.py'))
      deps    = $false
      running = [bool](Get-Server)
    }
    if ($o.venv) {
      $r = & $Py -c "import importlib.util as u; print(int(bool(u.find_spec('torch'))), int(bool(u.find_spec('aiohttp')) and bool(u.find_spec('comfyui_frontend_package'))))"
      $parts = "$r".Trim().Split(' ')
      $o.torch = $parts[0] -eq '1'; $o.deps = $parts[1] -eq '1'
    }
    $o | ConvertTo-Json -Compress
  }
  default { throw "bilinmeyen adım: $Step" }
}
