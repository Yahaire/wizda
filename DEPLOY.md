# Deployment (cPanel + AlmaLinux)

This guide covers deploying to a cPanel VPS on AlmaLinux with the **frontend on
the root domain** and the **backend API on a subdomain**, with PostgreSQL
installed directly on the server.

Concrete values used throughout (substitute your own where they differ):

- Root domain (frontend): `wizda.app`
- API subdomain: `api.wizda.app`
- cPanel account username: `<username>`

> **Root-domain note.** Because the frontend is served from the account's
> **primary** domain (not a subdomain), the Apache reverse proxy has to leave
> AutoSSL's validation path alone — see section F. A subdomain-only deploy
> doesn't hit this.

### Security: network exposure

> **Deployment is not complete until the app's service ports are unreachable
> from the public internet.** This is a hard requirement, not optional
> hardening.

This app runs its Node services under PM2 — `wizda-web` (port 4000) and
`wizda-api` (port 4001). They are designed to be reached **only through the
Apache reverse proxy over localhost** (see section F) and must never be directly
reachable from the internet.

> **Shared-server ports.** Ports are per-machine, not per-cPanel-user. The
> sibling `conjapo` account on this box already occupies 3000–3002 (web/api/
> Umami), so wizda uses **4000/4001** to avoid an `EADDRINUSE` collision. Pick a
> free pair for any further app.

Hitting a service directly on its raw port bypasses everything Apache provides —
TLS termination, the WAF/ModSecurity layer, security headers, and domain routing
— and exposes the raw Node process to the open internet. Leaving these ports
public was the exact gap found and closed during the sibling project's June 2026
server security review; wizda must not repeat it.

Two independent layers enforce this, and **both** must be in place so a slip in
one is still covered by the other:

**1. Bind each service to `127.0.0.1`, not `0.0.0.0`/`*`.**

- `wizda-api` (Express): already binds `127.0.0.1` by default — `src/index.ts`
  reads an optional `HOST` env var that defaults to `127.0.0.1`. Do **not** set
  `HOST=0.0.0.0` in the server `.env`.
- `wizda-web` (Next.js): pass `-H 127.0.0.1` to the start command (see section E).

Verify after (re)starting — both ports below should read `127.0.0.1`, never `*`
or `0.0.0.0`:

```bash
ss -tlnp | grep -E ':400[01]'
```

**2. Run a deny-by-default perimeter firewall** that does not expose ports
4000–4001 (nor any other non-public service port). The firewall is the safety
net; the localhost binding is the primary control.

### Prerequisites

- VPS cPanel account on AlmaLinux with SSH and root access
- `ea-nodejs22` installed via WHM → EasyApache 4
- `wizda.app` set as the account's primary domain, and the `api.wizda.app`
  subdomain created (cPanel → Domains / Subdomains), both with AutoSSL certs
- A git remote (GitHub, GitLab, etc.) the server can clone from

### A. Node.js Symlinks (via SSH, one-time)

EasyApache installs Node.js outside the system PATH. Symlink the binaries so all tools work without full paths:

```bash
ln -s /opt/cpanel/ea-nodejs22/bin/node /usr/local/bin/node
ln -s /opt/cpanel/ea-nodejs22/bin/npm /usr/local/bin/npm
ln -s /opt/cpanel/ea-nodejs22/bin/npx /usr/local/bin/npx
ln -s /opt/cpanel/ea-nodejs22/bin/pm2 /usr/local/bin/pm2
```

> The last symlink for `pm2` can only be created after installing PM2 in step E.

### B. PostgreSQL Setup (via SSH + cPanel, one-time)

Install and start PostgreSQL via SSH:

```bash
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql
```

Then create the database and user through **cPanel → PostgreSQL Database Wizard**:

1. Create a database named `wizda` (cPanel will prefix it with your account name, e.g. `<username>_wizda`)
2. Create a user named `wizda_user` (cPanel will prefix it, e.g. `<username>_wizda_user`) — do **not** use the same name as the database or cPanel will reject it
3. Grant the user all privileges on the database

#### PostgreSQL management tips

##### Browsing live data

Once the database and user exist, they will appear in **cPanel → phpPgAdmin**, where you can browse tables and run queries through a web UI. Use **WHM → Database Mapper** to make cPanel-created databases visible there if they don't show up automatically.

##### Superuser shell

For manual operations (e.g. dropping an orphaned database that cPanel failed to clean up), connect as the PostgreSQL superuser via:

```bash
psql -U postgres -h 127.0.0.1
```

`sudo -u postgres psql` may fail on cPanel servers because `pg_hba.conf` requires password auth even for local socket connections. The `-h 127.0.0.1` flag connects over TCP instead and works reliably.

### C. Environment Variables

Create a `.env` file in the repo root on the server (e.g. `~/repositories/wizda/.env`).
The seed reads all four source URLs — omitting any of them fails the seed in
section G. See `.env.example` for the authoritative list.

```
DATABASE_URL="postgresql://<username>_wizda_user:yourpassword@localhost:5432/<username>_wizda"

WEB_CLIENT_URL="https://wizda.app"
API_URL="https://api.wizda.app"

# Backend API port. Default is 3001, but if another app already holds it,
# you'll need to pick a free pair for any further app.
# The frontend's port is set by its `-p` flag in section E, not by this var.
PORT="4001"

# Seed data sources (all required by `npm run seed` / `prisma db seed`)
JUNK_DROP_RATES_SOURCE_URL="https://wizardry.info/daphne/gacha_rates/en/equipments.html"
EQUIPMENT_BLESSING_DROP_RATES_SOURCE_URL="https://wizardry.info/daphne/gacha_rates/en/alternations.html"
WEAPON_TAXONOMY_SOURCE_URL="https://raw.githubusercontent.com/itsnicksia/wizardry-daphne-guide/main/data/weapon.csv"
ARMOR_TAXONOMY_SOURCE_URL="https://raw.githubusercontent.com/itsnicksia/wizardry-daphne-guide/main/data/armor.csv"
```

> The backend binds `127.0.0.1` by default; do **not** add `HOST=0.0.0.0` here
> (see "Security: network exposure"). Analytics (Umami) and its env vars are not
> provisioned yet — leave them out; the app runs fine without them.

> **Runtime vs build-time env — this bites.** The two apps read env differently:
> - **`wizda-api`** loads `.env` at process start, so `DATABASE_URL`, `PORT`,
>   `HOST`, and the seed source URLs take effect on a plain `pm2 restart
>   wizda-api` — no rebuild.
> - **`wizda-web`** bakes `API_URL` and any `NEXT_PUBLIC_*` into the build:
>   `next build` writes the rewrite destinations into `.next/routes-manifest.json`,
>   and `next start` only serves that manifest. Changing `API_URL` therefore
>   requires **`npm run build:web-client` + `pm2 restart wizda-web`** — a restart
>   alone keeps serving the old value. (Symptom: `https://api.wizda.app/equipment`
>   works directly, but `https://wizda.app/api/equipment` 404s because the stale
>   manifest still proxies to a wrong/old host.)

### D. cPanel Git Version Control

1. cPanel → **Git Version Control** → **Create**
2. Set **Clone URL** to your GitHub/GitLab repo URL
3. Set **Repository Path** to e.g. `/home/<username>/repositories/wizda`
4. Create the repository

The `.cpanel.yml` file in the repo root runs `npm install` automatically after each deploy. The build step cannot run in cPanel's deploy environment (see `.cpanel.yml` for details), so the build and restart must be done manually via SSH after deploying (see section H).

### E. PM2 Setup (via SSH, one-time)

PM2 keeps the Node.js processes alive and restarts them on server reboot.

```bash
npm install -g pm2
```

Install deps and build once, then start both apps. (The section D deploy already
runs `npm install`, but run it explicitly here so this step stands on its own —
the build fails silently if deps are missing.) Note `-H 127.0.0.1` on the
frontend — it keeps the Next.js port loopback-only (see "Security: network
exposure"); the API binds loopback on its own.

```bash
cd ~/repositories/wizda
npm install
npm run build

# Backend API (uses port 3001 by default or PORT from .env, binds 127.0.0.1 by default)
pm2 start packages/backend-api/dist/backend-api/src/index.js --name wizda-api

# Frontend (Here, it's put on port 4000, forced onto 127.0.0.1)
pm2 start node_modules/next/dist/bin/next --name wizda-web -- start packages/web-client -p 4000 -H 127.0.0.1
```

Save and configure PM2 to start on boot:

```bash
pm2 save
pm2 startup
# Run the command it prints, then run pm2 save again
```

### F. Apache Reverse Proxy (via SSH, one-time)

Create a config file for each vhost. **The frontend vhost is the primary domain**,
so its config must exclude AutoSSL's ACME challenge path — otherwise the proxy
swallows `/.well-known/acme-challenge/` and certificate renewal fails.

Frontend (root domain):

```bash
nano /etc/apache2/conf.d/userdata/ssl/2/<username>/wizda.app/proxy.conf
```

Contents:

```apache
# Let AutoSSL serve its ACME challenge from disk, not the Node app.
ProxyPass /.well-known/ !
ProxyPass / http://127.0.0.1:4000/
ProxyPassReverse / http://127.0.0.1:4000/
```

API (subdomain):

```bash
nano /etc/apache2/conf.d/userdata/ssl/2/<username>/api.wizda.app/proxy.conf
```

Contents:

```apache
ProxyPass / http://127.0.0.1:4001/
ProxyPassReverse / http://127.0.0.1:4001/
```

Then rebuild and restart Apache:

```bash
/scripts/rebuildhttpdconf
systemctl restart httpd
```

> **Note:** The `ssl/2` path is for HTTPS (port 443). If the directories don't
> exist yet, create them with `mkdir -p`. On the primary domain the directory is
> named after the domain itself (`wizda.app`), same as a subdomain.

### G. First-Time Database Setup (via SSH, one-time)

```bash
cd ~/repositories/wizda
npx prisma migrate deploy
npm run db:seed:maintenance
```

`db:seed:maintenance` loads all four sources from section C and wipe-and-rebuilds
the tables (see `CLAUDE.md` / `docs/domain.md`) behind a `.maintenance` flag that
clears on success. It is idempotent — safe to re-run. (There's no root `npm run
seed`; the underlying script lives in the `backend-api` workspace and is invoked
by Prisma via `prisma.config.ts`.)

### H. Subsequent Deployments

#### Code updates

For code changes (including schema migrations):

1. Push commits to your git remote
2. cPanel → Git Version Control → **Deploy HEAD Commit**
   - This pulls the latest code and runs `npm install` automatically
3. SSH into the server and run:

```bash
cd ~/repositories/wizda
npm install               # redundant if the cPanel deploy ran; safe to repeat
npx prisma migrate deploy
npm run build
pm2 restart all

# Single line version (if you're confident it'll run)
cd ~/repositories/wizda && npm install && npx prisma migrate deploy && npm run build && pm2 restart all
```

#### Data updates

When the source pages change or the scraper/seed logic changes, re-seed without redeploying code:

```bash
cd ~/repositories/wizda
npm run db:seed:maintenance
```

This sets a maintenance flag before seeding and clears it on success. If the seed fails, the flag is left in place intentionally — the DB may be in a partial state, so it's safer to keep the maintenance page up until you fix the issue and re-run. To clear it manually (e.g. after a killed process):

```bash
rm .maintenance
```
