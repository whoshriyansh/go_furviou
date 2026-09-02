#!/usr/bin/env bash
# First-time setup on a fresh Ubuntu EC2 box. Run as ubuntu.
set -euo pipefail

APP_DIR=/opt/furviou
REPO="${REPO_URL:-git@github.com:whoshriyansh/go_furviou.git}"

sudo apt-get update
sudo apt-get install -y ca-certificates curl git debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo corepack enable
sudo corepack prepare pnpm@11.23.0 --activate

if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker ubuntu
fi

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
  sudo apt-get update
  sudo apt-get install -y caddy
fi

if [ ! -d "$APP_DIR/.git" ]; then
  sudo mkdir -p /opt
  sudo git clone "$REPO" "$APP_DIR"
  sudo chown -R ubuntu:ubuntu "$APP_DIR"
fi

cd "$APP_DIR"
pnpm install --frozen-lockfile

if [ ! -f "$APP_DIR/apps/api/.env" ]; then
  cp "$APP_DIR/apps/api/.env.example" "$APP_DIR/apps/api/.env"
  echo "Edit $APP_DIR/apps/api/.env before starting the service."
fi

docker start furviou-redis 2>/dev/null || docker run -d --name furviou-redis --restart unless-stopped -p 127.0.0.1:6379:6379 redis:7-alpine

sudo cp "$APP_DIR/deploy/furviou-api.service" /etc/systemd/system/furviou-api.service
sudo cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
sudo systemctl daemon-reload
sudo systemctl enable --now furviou-api
sudo systemctl reload caddy

echo "EC2 API host is ready. Point server.furviou.com A record at this instance, then fill apps/api/.env."
