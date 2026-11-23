// SPDX-License-Identifier: AGPL-3.0-only
export const setupRows = {
  python: ['Python 3.12 + PyTorch (CUDA)', 'Python 3.12 + PyTorch（CUDA）', 'Python 3.12 + PyTorch (CUDA)'],
  download: ['~3 GB download', '约需下载 3 GB', '~3 GB indirme'],
  cached: ['~3 GB download (fast if cached)', '约需下载 3 GB（有缓存时较快）', '~3 GB indirme (önbellekte varsa hızlı)'],
  update: ['Repeat = update', '再次执行即更新', 'Tekrar = güncelle'],
  comfyDeps: ['ComfyUI dependencies + Manager', 'ComfyUI 依赖和 Manager', 'ComfyUI bağımlılıkları + Manager'],
  comfyServer: ['ComfyUI server', 'ComfyUI 服务器', 'ComfyUI sunucusu'],
  starting: ['Starting…', '正在启动…', 'açılıyor…'],
  autoStart: ['Also starts automatically when a workflow runs', '运行工作流时也会自动启动', 'İş akışı çalışınca kendiliğinden de açılır'],
  kimodoRepo: ['Kimodo repository (NVIDIA)', 'Kimodo 仓库（NVIDIA）', 'Kimodo deposu (NVIDIA)'],
  kimodoDeps: ['Kimodo dependencies', 'Kimodo 依赖', 'Kimodo bağımlılıkları'],
  hf: ['Hugging Face access (Llama-3-8B)', 'Hugging Face 访问权限（Llama-3-8B）', 'Hugging Face erişimi (Llama-3-8B)'],
  hfKey: ['Settings → Hugging Face key', '设置 → Hugging Face 密钥', 'Ayarlar → Hugging Face anahtarı'],
  service: ['Generation service', '生成服务', 'Üretim servisi'],
  firstLoad: ['Loading… (downloads models on first start)', '正在加载…（首次启动会下载模型）', 'yükleniyor… (ilk açılışta modeller iner)'],
  vm: ['Virtual Machine Platform + Ubuntu', '虚拟机平台和 Ubuntu', 'Sanal Makine Platformu + Ubuntu'],
  admin: ['Administrator approval + restart', '需要管理员授权并重启', 'yönetici onayı + yeniden başlatma'],
  bios: ['SVM/VT-x is disabled in BIOS — enable it first', 'BIOS 中的 SVM/VT-x 已禁用，请先启用', 'BIOS’ta SVM/VT-x kapalı — önce açılmalı'],
  repos: ['Kimodo repositories', 'Kimodo 仓库', 'Kimodo depoları'],
  docker: ['Docker image (~15 GB)', 'Docker 镜像（约 15 GB）', 'Docker imajı (~15 GB)'],
  motionGpu: ['Text-to-motion (local GPU)', '文本生成动作（本地 GPU）', 'Metinden hareket üretimi (yerel GPU)']
} as const
