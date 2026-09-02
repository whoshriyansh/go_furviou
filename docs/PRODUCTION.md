# Production (Vercel + AWS EC2)

Live URLs this repo is set up for:

| Piece | URL |
| --- | --- |
| Frontend | https://go.furviou.com |
| API | https://server.furviou.com |
| Health | https://server.furviou.com/api/health |

CI/CD deploys **only when code is merged to `main`**. Pushes to `dev` or any other branch do nothing. See `.github/workflows/deploy.yml`.

Env files (never commit the real ones):

| Where | File | What it is for |
| --- | --- | --- |
| Laptop, API | `apps/api/.env` | Copy from `apps/api/.env.example` |
| Laptop, web | `apps/web/.env.local` | Copy from `apps/web/.env.example` |
| EC2, API | `/opt/furviou/apps/api/.env` | Production secrets. Git ignore keeps this file on the box after deploys. |
| Vercel | Project → Settings → Environment Variables | `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_API_URL` |

| Variable | Local | Production |
| --- | --- | --- |
| `FRONTEND_URL` | `http://localhost:3000` | `https://go.furviou.com` |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | `https://server.furviou.com` |
| `GOOGLE_MAILBOX_REDIRECT_URI` | `http://localhost:4000/api/auth/gmail/callback` | `https://server.furviou.com/api/auth/gmail/callback` |

## 1. DNS

In your domain registrar (or Route 53):

| Host | Type | Value |
| --- | --- | --- |
| `go` | CNAME | `cname.vercel-dns.com` (Vercel shows the exact target) |
| `server` | A | EC2 **Elastic IP** |

Wait until both resolve before Google OAuth will work.

```sh
dig +short go.furviou.com
dig +short server.furviou.com
```

## 2. MongoDB Atlas

1. Create/use a cluster. Database name `furviou` is fine.
2. **Database Access** → user + password.
3. **Network Access** → Add IP Address → paste the EC2 **Elastic IP** as `x.x.x.x/32`. Also add your laptop IP if you want to inspect data from Compass. Do not use `0.0.0.0/0` in production if you can avoid it.
4. If the password has `@`, `#`, or `/`, URL-encode it in the URI.
5. Connection string:

```
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/furviou
```

## 3. Google Cloud / GCP (production + local)

Keep **local and production** on the same OAuth clients.

### Login client (GIS) — JavaScript origins

```
http://localhost:3000
https://go.furviou.com
```

No redirect URI is required for the Sign in with Google button.

Use this Client ID as:

- `GOOGLE_CLIENT_ID` on the API
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel

They must be identical.

### Mailbox client — authorized redirect URIs

```
http://localhost:4000/api/auth/gmail/callback
https://server.furviou.com/api/auth/gmail/callback
```

Set API:

```
GOOGLE_MAILBOX_REDIRECT_URI=https://server.furviou.com/api/auth/gmail/callback
```

Add every Gmail that will sign in or send as an OAuth **test user** until the Google app is published.

## 4. Vercel (frontend)

From your laptop (one-time):

```sh
cd /path/to/go_furviou
pnpm dlx vercel login
pnpm dlx vercel link --yes --project furviou-web
```

In the Vercel project:

- **Root Directory:** `apps/web`
- **Framework:** Next.js
- **Install:** `cd ../.. && pnpm install`
- **Build:** `cd ../.. && pnpm --filter web build`
- **Output:** leave default Next.js
- **Production branch:** `main`
- Turn **off** Vercel Git auto-deploy (Settings → Git → Ignored Build Step, or disconnect Git deploy) if you want only GitHub Actions to ship. Otherwise Vercel and GitHub would both deploy.

Environment variables (Production):

```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-login-client-id
NEXT_PUBLIC_API_URL=https://server.furviou.com
```

No trailing slash. Redeploy after changing `NEXT_PUBLIC_*`.

Add domain `go.furviou.com` in Vercel → Project → Domains.

Copy from Vercel settings into GitHub secrets:

- `VERCEL_TOKEN` (https://vercel.com/account/tokens)
- `VERCEL_ORG_ID` (Project → Settings → General)
- `VERCEL_PROJECT_ID`

## 5. AWS EC2 (API)

### Create the box (AWS console)

1. Pick a region close to you (or to Atlas).
2. **EC2 → Launch instance**
   - Name: `furviou-api`
   - AMI: **Ubuntu Server 24.04 LTS**
   - Type: `t3.small` (or `t3.micro` to start)
   - Key pair: create one, download the `.pem`, then on your laptop: `chmod 400 ~/Downloads/your-key.pem`
   - Network: default VPC, **auto-assign public IP**
   - Storage: 20 GB is enough
3. **Security group** inbound (see table below).
4. Launch, then **Elastic IPs → Allocate → Associate** with this instance. Use that IP everywhere (DNS, Atlas, GitHub `EC2_HOST`).
5. Optional from a laptop with AWS CLI:

```sh
aws ec2 allocate-address --domain vpc
aws ec2 associate-address --instance-id i-xxxxxxxx --allocation-id eipalloc-xxxxxxxx
```

Security group inbound:

| Port | Source | Why |
| --- | --- | --- |
| 22 | your IP | SSH |
| 80 | 0.0.0.0/0 | Caddy HTTP → HTTPS |
| 443 | 0.0.0.0/0 | API TLS |
| 4000 | *closed* | API is local-only behind Caddy |

SSH in, then:

```sh
ssh -i your-key.pem ubuntu@YOUR_ELASTIC_IP
export REPO_URL=git@github.com:whoshriyansh/go_furviou.git
curl -fsSL https://raw.githubusercontent.com/whoshriyansh/go_furviou/main/deploy/setup-ec2.sh | bash
```

Or clone first and run `bash deploy/setup-ec2.sh`.

The box needs **read** access to GitHub (deploy key):

```sh
ssh-keygen -t ed25519 -C "furviou-ec2" -f ~/.ssh/furviou_deploy -N ""
cat ~/.ssh/furviou_deploy.pub
```

GitHub repo → Settings → Deploy keys → paste the public key (read-only).

`~/.ssh/config` on EC2:

```
Host github.com
  IdentityFile ~/.ssh/furviou_deploy
  StrictHostKeyChecking accept-new
```

Then clone if the setup script has not already:

```sh
sudo mkdir -p /opt
sudo git clone git@github.com:whoshriyansh/go_furviou.git /opt/furviou
sudo chown -R ubuntu:ubuntu /opt/furviou
```

### API env on the server

```sh
nano /opt/furviou/apps/api/.env
```

Generate `JWT_SECRET` on the box:

```sh
openssl rand -base64 32
```

Production file:

```
NODE_ENV=production
PORT=4000
HOST=0.0.0.0
TRUST_PROXY=1
FRONTEND_URL=https://go.furviou.com
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster.xxxxx.mongodb.net/furviou
JWT_SECRET=paste-the-openssl-output
GOOGLE_CLIENT_ID=same-as-vercel
GOOGLE_MAILBOX_CLIENT_ID=mailbox-client-id
GOOGLE_MAILBOX_CLIENT_SECRET=mailbox-client-secret
GOOGLE_MAILBOX_REDIRECT_URI=https://server.furviou.com/api/auth/gmail/callback
REDIS_URL=redis://127.0.0.1:6379
SEND_SWEEP_INTERVAL_MS=30000
SEND_CONCURRENCY=3
```

Then:

```sh
sudo cp /opt/furviou/deploy/furviou-api.service /etc/systemd/system/furviou-api.service
sudo cp /opt/furviou/deploy/Caddyfile /etc/caddy/Caddyfile
sudo visudo
```

In visudo add:

```
ubuntu ALL=NOPASSWD: /usr/bin/systemctl restart furviou-api, /usr/bin/systemctl reload caddy, /usr/bin/corepack
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now furviou-api
sudo systemctl reload caddy
curl -fsS http://127.0.0.1:4000/api/health
curl -fsS https://server.furviou.com/api/health
```

Both should return `"ok": true`.

## 6. GitHub secrets (Actions)

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
| --- | --- |
| `VERCEL_TOKEN` | Vercel token |
| `VERCEL_ORG_ID` | Vercel org/team id |
| `VERCEL_PROJECT_ID` | Vercel project id |
| `EC2_HOST` | `server.furviou.com` or the Elastic IP |
| `EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | **private** SSH key that can log into EC2 (`cat your-key.pem`) |

Do **not** add required reviewers on a GitHub Environment. Deploy must run by itself after tests pass.

## 7. What happens on merge to main

1. GitHub Action runs `pnpm test` (personalize tests + typecheck).
2. If tests pass, Vercel production deploy for `go.furviou.com`.
3. SSH to EC2, `git reset --hard origin/main`, `pnpm install`, restart the API.

Nothing runs on `dev` or feature branches.

## 8. Manual deploy from your laptop

Frontend:

```sh
cd apps/web
npx vercel --prod --token "$VERCEL_TOKEN"
```

API (after SSH keys work):

```sh
ssh -i your-key.pem ubuntu@server.furviou.com 'cd /opt/furviou && git fetch origin main && git reset --hard origin/main && pnpm install --frozen-lockfile && sudo systemctl restart furviou-api && curl -fsS http://127.0.0.1:4000/api/health'
```

## 9. Record a video / smoke check

1. Open https://go.furviou.com → Google sign-in.
2. Mailbox → Connect Gmail → Connected.
3. Campaign → sequence with `{{firstName}}` / `{{lastName}}` / `{{iceBreaker}}`.
4. Import a CSV that includes name + email. Map **Name** to Full name (or First + Last). Map icebreaker if you have that column.
5. Preview should show the real name, not blank tokens. `{{lastName}}` is filled from a full name like `Shriyansg Lohia`.
6. Launch or **Send now (test)**.
7. Gmail Sent has the substituted values. A line such as `love from` after a blank line is the **mailbox signature**, not a merge field.
8. https://server.furviou.com/api/health stays green.

## 10. Keep it up

- Elastic IP so Mongo Atlas + DNS do not change after reboot.
- Redis container `--restart unless-stopped` (setup script does this).
- `Restart=always` on `furviou-api`.
- Caddy renews TLS by itself.
- Atlas IP = Elastic IP. If you replace the instance, update Atlas.
