#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# AssetForge — Kimodo kurulumu (WSL Ubuntu içinde root olarak çalışır).
# Kullanım: setup_wsl.sh <adım> [FORGE_DIR]
#   docker   : Docker Engine + NVIDIA Container Toolkit
#   clone    : kimodo + kimodo-viser depoları (/opt/kimodo)
#   token    : HF_TOKEN ortam değişkenindeki Hugging Face anahtarını yazar
#   build    : Docker imajını derler (uzun sürer, ~15 GB)
#   start    : servisi başlatır (port 9551)
#   stop     : servisi durdurur
#   status   : kısa durum özeti (JSON)
set -euo pipefail
STEP="${1:-status}"
FORGE_SRC="${2:-}"
KIMODO=/opt/kimodo
export DEBIAN_FRONTEND=noninteractive

log() { echo "[forge] $*"; }

case "$STEP" in
  docker)
    if ! command -v docker >/dev/null 2>&1; then
      log "Docker kuruluyor…"
      apt-get update -qq
      apt-get install -y -qq docker.io docker-compose-v2 git curl ca-certificates gnupg >/dev/null
    fi
    if ! command -v nvidia-ctk >/dev/null 2>&1; then
      log "NVIDIA Container Toolkit kuruluyor…"
      curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --batch --yes --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
      curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
        | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
        > /etc/apt/sources.list.d/nvidia-container-toolkit.list
      apt-get update -qq
      apt-get install -y -qq nvidia-container-toolkit >/dev/null
    fi
    nvidia-ctk runtime configure --runtime=docker >/dev/null
    (systemctl restart docker 2>/dev/null || service docker restart) >/dev/null
    for i in $(seq 1 20); do docker info >/dev/null 2>&1 && break; sleep 1; done
    docker info >/dev/null
    log "Docker hazır: $(docker --version)"
    if docker run --rm --gpus all ubuntu:24.04 nvidia-smi -L 2>/dev/null; then log "GPU konteynerde görünüyor"; else log "UYARI: GPU konteynerde görünmedi (NVIDIA sürücüsü WSL desteği?)"; fi
    ;;
  clone)
    if [ ! -d "$KIMODO/.git" ]; then
      log "kimodo indiriliyor…"
      git clone --depth 1 https://github.com/nv-tlabs/kimodo.git "$KIMODO"
    else
      git -C "$KIMODO" pull --ff-only || true
    fi
    if [ ! -d "$KIMODO/kimodo-viser/.git" ]; then
      git clone --depth 1 https://github.com/nv-tlabs/kimodo-viser.git "$KIMODO/kimodo-viser"
    fi
    mkdir -p "$KIMODO/forge"
    if [ -n "$FORGE_SRC" ]; then
      cp "$FORGE_SRC/forge_kimodo_server.py" "$FORGE_SRC/forge_motion.py" "$FORGE_SRC/docker-compose.forge.yaml" "$KIMODO/forge/"
    fi
    log "depolar hazır: $KIMODO"
    ;;
  token)
    mkdir -p /root/.cache/huggingface
    if [ -z "${HF_TOKEN:-}" ]; then log "HF_TOKEN boş"; exit 2; fi
    printf "%s" "$HF_TOKEN" > /root/.cache/huggingface/token
    chmod 600 /root/.cache/huggingface/token
    code=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $HF_TOKEN" \
      https://huggingface.co/api/models/meta-llama/Meta-Llama-3-8B-Instruct/tree/main || true)
    if [ "$code" = "200" ]; then log "Hugging Face: Llama-3-8B-Instruct erişimi var"; else log "UYARI: Llama-3-8B-Instruct erişimi yok (HTTP $code) — huggingface.co'da lisansı kabul edin"; exit 3; fi
    ;;
  build)
    cd "$KIMODO"
    [ -n "$FORGE_SRC" ] && cp "$FORGE_SRC/forge_kimodo_server.py" "$FORGE_SRC/forge_motion.py" "$FORGE_SRC/docker-compose.forge.yaml" "$KIMODO/forge/"
    log "Docker imajı derleniyor (ilk seferde 20-40 dk sürebilir)…"
    docker compose -f forge/docker-compose.forge.yaml build --progress plain 2>&1 | grep -E "^#[0-9]+ (DONE|\[)|ERROR|error" || true
    docker image inspect kimodo:1.0 >/dev/null && log "imaj hazır: kimodo:1.0"
    ;;
  start)
    cd "$KIMODO"
    [ -n "$FORGE_SRC" ] && cp "$FORGE_SRC/forge_kimodo_server.py" "$FORGE_SRC/forge_motion.py" "$FORGE_SRC/docker-compose.forge.yaml" "$KIMODO/forge/"
    docker compose -f forge/docker-compose.forge.yaml up -d
    log "servis başlatıldı; model ve metin kodlayıcı yükleniyor (ilk seferde ağırlıklar indirilir)"
    ;;
  stop)
    cd "$KIMODO" && docker compose -f forge/docker-compose.forge.yaml down
    ;;
  logs)
    docker logs --tail 40 forge-kimodo 2>&1 || true
    ;;
  status)
    d=false; n=false; c=false; t=false; i=false; r=false
    command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 && d=true
    command -v nvidia-ctk >/dev/null 2>&1 && n=true
    [ -d "$KIMODO/.git" ] && [ -d "$KIMODO/kimodo-viser" ] && c=true
    [ -s /root/.cache/huggingface/token ] && t=true
    $d && docker image inspect kimodo:1.0 >/dev/null 2>&1 && i=true
    $d && [ "$(docker inspect -f '{{.State.Running}}' forge-kimodo 2>/dev/null || echo false)" = "true" ] && r=true
    echo "{\"docker\":$d,\"toolkit\":$n,\"cloned\":$c,\"token\":$t,\"image\":$i,\"running\":$r}"
    ;;
  *)
    echo "bilinmeyen adım: $STEP"; exit 1;;
esac
