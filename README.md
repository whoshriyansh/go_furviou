# Furviou Go

Self-hosted email outreach. **That is the whole product:** you write a sequence, import leads, connect Gmail, and Furviou sends the first email and the follow-ups.

It does not scrape LinkedIn, write copy with AI, track opens, or run ads. One mailbox, your leads, scheduled email, replies stop the rest of the sequence.

If this saves you time, [buy me a coffee](https://razorpay.me/@plavist). If you want a hosted cloud version, **star this repo** so I know people actually want it: [github.com/whoshriyansh/go_furviou](https://github.com/whoshriyansh/go_furviou).

## What you get

- Google sign-in
- Connect a Gmail mailbox (`gmail.send` + `gmail.readonly`)
- Campaigns with a sequence of emails
- CSV lead import (one Lead per email, linked to campaigns by ID)
- Send window + timezone (mail waits until that window, even if a step says "no extra wait")
- Follow-ups in the same thread or as a new email
- Stop on reply
- Redis + BullMQ so every send is a durable job (nothing depends on a timer in memory)

## Tech stack

| Layer | Stack |
| --- | --- |
| Web | Next.js 16, React 19, Tailwind |
| API | Express 5, Mongoose |
| Database | MongoDB (Atlas is fine) |
| Queue | Redis 7 + BullMQ |
| Auth | Google Identity Services + JWT |
| Sending | Gmail API from your connected mailbox |
| Monorepo | pnpm workspaces + Turborepo |
| Shared code | `@furviou/shared` (lead fields, personalize, timezones) |

Node **22+** and **pnpm 11** are required (`packageManager` in the root `package.json`).

## How the monorepo works

This is one git repo with several packages. pnpm links them. Turborepo runs scripts across them.

```
go_furviou/
├── apps/
│   ├── web/          # Next.js UI  → http://localhost:3000
│   └── api/          # Express API + send worker → http://localhost:4000
├── packages/
│   ├── shared/       # @furviou/shared — imported by web and api
│   ├── ui/           # shared UI kit
│   ├── eslint-config/
│   └── typescript-config/
├── pnpm-workspace.yaml
└── turbo.json
```

`pnpm-workspace.yaml` includes `apps/*` and `packages/*`. From the **repo root**, `pnpm dev` starts every package that has a `dev` script (web on 3000, api on 4000) in one terminal.

Each app keeps its own env file:

- `apps/api/.env` — loaded by the API (`dotenv`)
- `apps/web/.env.local` — loaded by Next.js

Do not put secrets in the web env except the public Google client ID. Mailbox client secret and Mongo stay on the API.

## Prerequisites

- [Node.js 22+](https://nodejs.org/)
- [pnpm 11](https://pnpm.io/installation) (`corepack enable` then `corepack prepare pnpm@11.23.0 --activate`)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster (free M0 works) or MongoDB on your machine
- [Docker](https://docs.docker.com/get-docker/) (for local Redis)
- A [Google Cloud](https://console.cloud.google.com/) project you own

## 1. Clone

```sh
git clone https://github.com/whoshriyansh/go_furviou.git
cd go_furviou
```

## 2. Install

```sh
pnpm install
```

## 3. Env files

```sh
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill both files using the sections below. Examples live in:

- [`apps/api/.env.example`](apps/api/.env.example)
- [`apps/web/.env.example`](apps/web/.env.example)

Generate a JWT secret:

```sh
openssl rand -base64 32
```

Paste it into `JWT_SECRET` in `apps/api/.env`.

## 4. MongoDB

1. Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Database Access** → add a user with a password.
3. **Network Access** → add your IP, or `0.0.0.0/0` for local testing only.
4. **Connect** → Drivers → copy the URI.
5. Put the database name in the path (`furviou` is fine):

```
MONGO_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/furviou
```

URL-encode special characters in the password.

## 5. Redis (required)

Sends are BullMQ jobs. Redis must be running before `pnpm dev`.

One-shot container:

```sh
docker run -d --name furviou-redis -p 6379:6379 redis:7-alpine
```

Or from this repo:

```sh
docker compose up -d redis
```

Useful extras:

```sh
docker start furviou-redis          # if the container already exists
docker logs -f furviou-redis        # confirm it is up
```

Then in `apps/api/.env`:

```
REDIS_URL=redis://127.0.0.1:6379
```

## 6. Google keys (login + Gmail)

You need Google for two different jobs:

1. **Sign in** — Google button on the site (Client ID only).
2. **Mailbox** — user connects Gmail so the API can send mail and see replies (Client ID + secret + redirect URI).

You can use **one** Web application OAuth client for both, or **two** clients (login vs mailbox). Two is what the env vars are named for. One client is fewer clicks: paste the same ID into every `*_CLIENT_ID` field.

### Create the Google Cloud project

1. Open [Google Cloud Console](https://console.cloud.google.com/) → new project (name it `furviou` or anything).
2. **APIs & Services → Library** → enable **Gmail API**. Login will not send mail without this.
3. **APIs & Services → OAuth consent screen** (sometimes under **Google Auth platform**):
   - User type: **External**
   - App name, user support email, developer contact
   - Scopes: `gmail.send`, `gmail.readonly`, plus the default `email`, `profile`, `openid`
   - Publishing status **Testing** → **Test users** → add **every Gmail** that will sign in or connect a mailbox. Google blocks everyone else until you publish the app.
4. **Credentials → Create credentials → OAuth client ID → Web application**

### Login client (GIS)

Authorized **JavaScript origins**:

```
http://localhost:3000
```

You do not need a redirect URI for the Sign in with Google button.

Copy the **Client ID** into:

- `GOOGLE_CLIENT_ID` in `apps/api/.env`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `apps/web/.env.local`

Those two values must be identical.

### Mailbox client (Gmail send)

Create a second Web application client, or reuse the login client and add this redirect.

Authorized **redirect URI** (must match the API port):

```
http://localhost:4000/api/auth/gmail/callback
```

If you change `PORT`, change this URI in Google Cloud **and** in `GOOGLE_MAILBOX_REDIRECT_URI`.

Copy:

- Client ID → `GOOGLE_MAILBOX_CLIENT_ID`
- Client secret → `GOOGLE_MAILBOX_CLIENT_SECRET`
- Redirect URI → `GOOGLE_MAILBOX_REDIRECT_URI=http://localhost:4000/api/auth/gmail/callback`

The connect flow asks Google for offline access (`access_type=offline` + consent) so a **refresh token** is stored. If Google does not return one, Mailbox will show “Needs reconnect” — disconnect the app in [Google Account → Third-party access](https://myaccount.google.com/connections) and connect again.

### Web API URL

```
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Must match `PORT` in `apps/api/.env`. Next.js inlines `NEXT_PUBLIC_*` at startup — restart `pnpm dev` after you change it.

## 7. Run

From the repo root:

```sh
pnpm dev
```

You should see:

- API: `Connected to MongoDB …` then `[send] BullMQ worker up` then `API running on port 4000`
- Web: Next.js ready on [http://localhost:3000](http://localhost:3000)

Open **http://localhost:3000**, sign in with a Google **test user**, go to **Mailbox**, connect Gmail, then **Campaigns**.

Useful commands from the root:

```sh
pnpm dev                          # web + api together
pnpm --filter web dev             # UI only
pnpm --filter api dev             # API only
pnpm build                        # production build
pnpm check-types
```

## First campaign

1. **Mailbox** → Connect Gmail → status **Connected** and “Refresh token saved”.
2. **Campaigns** → create one → write subject and body on every step.
3. **Leads list** → import a CSV with an `email` column.
4. **Launch** → pick the connected mailbox, set timezone to **where the leads live**, then launch.

“No extra wait” still waits for the **send window** (default Mon–Fri 09:00–18:00 in the campaign timezone). At 1am nothing goes out until that window. Use **Send now (test)** on Launch or Performance to send one lead immediately and confirm Gmail.

A real send shows up in:

- Gmail **Sent**
- Campaign **Performance → Recent sends**
- API log `[send] sent` or `[send] failed`

If the worker is waiting on the window you will see `[send] waiting` in the API terminal.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Google login is not configured” | Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and restart the web app. |
| Sign-in fails / 401 | Login Client ID on web and `GOOGLE_CLIENT_ID` on the API must match. Add yourself as an OAuth **test user**. |
| CORS / can’t reach the server | `FRONTEND_URL=http://localhost:3000`, `NEXT_PUBLIC_API_URL` matches the API port, both processes running. |
| `redirect_uri_mismatch` | Google Cloud redirect URI must equal `GOOGLE_MAILBOX_REDIRECT_URI` exactly (http vs https, port, path `/api/auth/gmail/callback`). |
| Mailbox “Needs reconnect” / no refresh token | App is in Testing; user is a test user; connect with consent; remove the app from Google connections and retry. |
| Launch works but nothing sends | Check send window + timezone. Look at Performance “Sending status” and the Leads **Next send** column. |
| `[send] failed` auth / invalid_grant | Reconnect the mailbox. Access tokens expire; refresh tokens go away if Google consent is revoked. |
| Mongo connection error | Check `MONGO_URI`, Atlas user password, and Network Access. |

## Deploy (production)

Production is **https://go.furviou.com** (Vercel) + **https://server.furviou.com** (AWS EC2). GitHub Actions deploys both **only on merge to `main`**.

Full AWS, DNS, Mongo IP, Google Cloud URLs, env files, and GitHub secrets: **[docs/PRODUCTION.md](docs/PRODUCTION.md)**.

## License

MIT. See [LICENSE](LICENSE).

---

[Buy me a coffee](https://razorpay.me/@plavist) · [Star the repo](https://github.com/whoshriyansh/go_furviou) if you want a cloud version
