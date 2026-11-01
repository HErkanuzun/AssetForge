# AssetForge — NVIDIA Kimodo'yu Windows'ta doğrudan (WSL/Docker olmadan) kurar ve çalıştırır.
# Kullanım: powershell -ExecutionPolicy Bypass -File setup_native.ps1 -Step <adım> -Root <klasör> [-Port 9551]
#   env     : uv ile Python 3.12 sanal ortamı + CUDA'lı PyTorch
#   clone   : kimodo deposu
#   deps    : kimodo ve bağımlılıkları (MotionCorrection isteğe bağlı)
#   token   : HF_TOKEN ortam değişkenindeki anahtarı yazar, Llama-3 erişimini doğrular
#   start   : üretim servisini arka planda başlatır
#   status  : JSON durum
param(
  [Parameter(Mandatory = $true)][string]$Step,
  [Parameter(Mandatory = $true)][string]$Root,
  [int]$Port = 9551,
  [string]$ForgeSrc = $PSScriptRoot
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
function Log($m) { Write-Output "[forge] $m" }

$Venv = Join-Path $Root 'venv'
$Py = Join-Path $Venv 'Scripts\python.exe'
$Repo = Join-Path $Root 'kimodo'
$HfHome = Join-Path $Root 'hf'
$LogFile = Join-Path $Root 'server.log'
New-Item -ItemType Directory -Force -Path $Root, $HfHome | Out-Null

function Find-Uv {
  $c = Get-Command uv -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $local = Join-Path $env:USERPROFILE '.local\bin\uv.exe'
  if (Test-Path $local) { return $local }
  Log 'uv kuruluyor…'
  Invoke-RestMethod https://astral.sh/uv/install.ps1 | Invoke-Expression
  return $local
}

switch ($Step) {
  'env' {
    $uv = Find-Uv
    if (-not (Test-Path $Py)) {
      Log 'Python 3.12 sanal ortamı oluşturuluyor…'
      & $uv venv --python 3.12 $Venv | Out-Null
    }
    $hasTorch = & $Py -c "import importlib.util,sys; sys.stdout.write('1' if importlib.util.find_spec('torch') else '0')"
    if ($hasTorch -ne '1') {
      Log 'PyTorch (CUDA 12.8) indiriliyor — ~3 GB…'
      & $uv pip install --python $Py torch --index-url https://download.pytorch.org/whl/cu128
      if ($LASTEXITCODE -ne 0) { throw 'PyTorch kurulamadı' }
    }
    $cuda = & $Py -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '-')"
    Log "PyTorch hazır — CUDA: $cuda"
  }
  'clone' {
    if (-not (Test-Path (Join-Path $Repo '.git'))) {
      Log 'kimodo indiriliyor…'
      git clone --depth 1 https://github.com/nv-tlabs/kimodo.git $Repo 2>&1 | Out-Null
      if ($LASTEXITCODE -ne 0) { throw 'git clone başarısız' }
    } else {
      git -C $Repo pull --ff-only 2>&1 | Out-Null
    }
    Log "depo hazır: $Repo"
  }
  'deps' {
    $uv = Find-Uv
    Log 'kimodo bağımlılıkları kuruluyor…'
    $env:SKIP_MOTION_CORRECTION_IN_SETUP = '1'
    & $uv pip install --python $Py -e $Repo
    if ($LASTEXITCODE -ne 0) { throw 'kimodo kurulamadı' }
    # MotionCorrection (ayak kayması düzeltme) C++ derleyici ister; olmazsa servis son işlemeyi atlar
    & $uv pip install --python $Py (Join-Path $Repo 'MotionCorrection') 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { Log 'MotionCorrection kuruldu' } else { Log 'MotionCorrection kurulamadı (isteğe bağlı) — son işleme kapalı çalışır' }
    & $Py -c "import kimodo; print('kimodo', 'ok')"
  }
  'token' {
    if (-not $env:HF_TOKEN) { Log 'HF_TOKEN boş'; exit 2 }
    $tokFile = Join-Path $HfHome 'token'
    [IO.File]::WriteAllText($tokFile, $env:HF_TOKEN.Trim())
    try {
      Invoke-WebRequest -UseBasicParsing -Headers @{ Authorization = "Bearer $($env:HF_TOKEN.Trim())" } `
        -Uri 'https://huggingface.co/api/models/meta-llama/Meta-Llama-3-8B-Instruct/tree/main' | Out-Null
      Log 'Hugging Face: Llama-3-8B-Instruct erişimi var'
    } catch {
      Log 'UYARI: Llama-3-8B-Instruct erişimi yok — huggingface.co/meta-llama/Meta-Llama-3-8B-Instruct sayfasında lisansı kabul edin'
      exit 3
    }
  }
  'start' {
    $server = Join-Path $ForgeSrc 'forge_kimodo_server.py'
    $env:HF_HOME = $HfHome
    $env:TEXT_ENCODER_MODE = 'local'
    $env:TEXT_ENCODER_DEVICE = 'cpu'
    $env:PYTHONUTF8 = '1'
    $existing = Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*forge_kimodo_server.py*' }
    if ($existing) { Log 'servis zaten çalışıyor'; break }
    Start-Process -FilePath $Py -ArgumentList @("`"$server`"", '--port', $Port) -WorkingDirectory $Repo -WindowStyle Hidden `
      -RedirectStandardOutput $LogFile -RedirectStandardError ($LogFile + '.err')
    Log "servis başlatıldı (port $Port); model ve metin kodlayıcı yükleniyor"
  }
  'stop' {
    Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*forge_kimodo_server.py*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
    Log 'servis durduruldu'
  }
  'logs' {
    foreach ($f in @($LogFile, ($LogFile + '.err'))) { if (Test-Path $f) { Get-Content $f -Tail 25 } }
  }
  'status' {
    $o = [ordered]@{
      venv    = (Test-Path $Py)
      torch   = $false
      cloned  = (Test-Path (Join-Path $Repo '.git'))
      kimodo  = $false
      token   = (Test-Path (Join-Path $HfHome 'token'))
      running = $false
    }
    if ($o.venv) {
      $r = & $Py -c "import importlib.util as u; print(int(bool(u.find_spec('torch'))), int(bool(u.find_spec('kimodo'))))"
      $parts = "$r".Trim().Split(' ')
      $o.torch = $parts[0] -eq '1'; $o.kimodo = $parts[1] -eq '1'
    }
    $o.running = [bool](Get-CimInstance Win32_Process -Filter "Name='python.exe'" | Where-Object { $_.CommandLine -like '*forge_kimodo_server.py*' })
    $o | ConvertTo-Json -Compress
  }
  default { throw "bilinmeyen adım: $Step" }
}
