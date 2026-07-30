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

Create a config file for each vhost.

The pattern is **catch-all proxy, minus the paths Apache must keep for itself**.
`ProxyPass /` is deliberately broad — the Node app owns the whole site, so it
should receive everything by default. Do *not* replace it with an allow-list of
specific routes: every new route in the app would then need an Apache edit plus a
rebuild and restart, and a forgotten one produces a 404 that looks exactly like an
application bug.

The exception list, by contrast, is closed and known — it does not grow as the app
grows. There are two kinds of exception, and they need **different treatment**:

| Path | Treatment | Why |
|---|---|---|
| `/.well-known/` | Exclude (`!`) | AutoSSL serves its ACME challenge from disk. Apache itself is the right handler, so telling mod_proxy to keep its hands off is exactly right. If the proxy swallows it, certificate renewal fails silently. |
| `/___proxy_subdomain_*` | Proxy explicitly | cPanel rewrites `cpanel.wizda.app`, `webmail.wizda.app` and `whm.wizda.app` onto these internal paths *within this vhost*, expecting its own `ProxyPass` to forward them to the local service ports. Apache cannot serve them from disk, so `!` does **not** work here — see the symptom section below. |

The distinction matters: `!` means "this is not a proxied path", which is true of
`/.well-known/` and false of the proxy subdomains. Using `!` on the latter
suppresses cPanel's own forwarding and leaves the request with no handler at all.

Frontend (root domain):

```bash
nano /etc/apache2/conf.d/userdata/ssl/2/<username>/wizda.app/proxy.conf
```

Contents — **exclusions must precede the catch-all; first match wins**:

```apache
# Let AutoSSL serve its ACME challenge from disk, not the Node app.
ProxyPass /.well-known/ !

# mod_proxy adds X-Forwarded-Host automatically but NOT X-Forwarded-Proto —
# without this, every request looks like plain HTTP to the Node app. See the
# "Symptom: language redirect goes to localhost:4000" note below for why this
# alone isn't enough to fix the redirect host, just the scheme.
RequestHeader set X-Forwarded-Proto "https"

# Send cPanel's proxy subdomains to their own services, not the Node app.
# The local services speak HTTPS with a certificate that does not match
# 127.0.0.1, so peer verification has to be off for this hop.
SSLProxyEngine On
SSLProxyVerify none
SSLProxyCheckPeerName off
SSLProxyCheckPeerCN off
SSLProxyCheckPeerExpire off

# No trailing slashes: this matches both /___proxy_subdomain_cpanel
# and /___proxy_subdomain_cpanel/whatever.
ProxyPass        /___proxy_subdomain_cpanel  https://127.0.0.1:2083
ProxyPassReverse /___proxy_subdomain_cpanel  https://127.0.0.1:2083
ProxyPass        /___proxy_subdomain_whm     https://127.0.0.1:2087
ProxyPassReverse /___proxy_subdomain_whm     https://127.0.0.1:2087
ProxyPass        /___proxy_subdomain_webmail https://127.0.0.1:2096
ProxyPassReverse /___proxy_subdomain_webmail https://127.0.0.1:2096

ProxyPass / http://127.0.0.1:4000/
ProxyPassReverse / http://127.0.0.1:4000/
```

Add further service subdomains the same way if you ever use them — Web Disk is
`2078`, cpcalendars/cpcontacts are `2080`. Only the ones listed above are needed
for normal cPanel/WHM/webmail access.

Once the entry page loads, cPanel navigates with session paths like
`/cpsess0123456789/…`. Those are **not** proxy-subdomain paths and would
otherwise be caught by `ProxyPass /` — they work because cPanel's own rewrite
matches on the `Host` header (`cpanel.wizda.app`) rather than on the path, and
so rewrites every subsequent request back onto `/___proxy_subdomain_cpanel/`
before mod_proxy sees it. That rewrite half was never the broken part.

API (subdomain):

```bash
nano /etc/apache2/conf.d/userdata/ssl/2/<username>/api.wizda.app/proxy.conf
```

Contents:

```apache
# Cheap insurance: keeps DCV working if a port-80 config is ever added.
ProxyPass /.well-known/ !

ProxyPass / http://127.0.0.1:4001/
ProxyPassReverse / http://127.0.0.1:4001/
```

cPanel does attach `cpanel.`/`webmail.`/`whm.` aliases to non-primary vhosts too,
so `cpanel.api.wizda.app` technically exists and is technically broken by the
catch-all here. Nobody visits it, so the proxy-subdomain block is not repeated —
but if you ever want it, the same lines work verbatim.

Then rebuild and restart Apache:

```bash
/scripts/rebuildhttpdconf
systemctl restart httpd
```

> **Note:** The `ssl/2` path is for HTTPS (port 443). If the directories don't
> exist yet, create them with `mkdir -p`. On the primary domain the directory is
> named after the domain itself (`wizda.app`), same as a subdomain.

> **Do not add an equivalent `std/2` (port 80) config.** AutoSSL performs its
> domain-control validation over plain HTTP. Port 80 having no catch-all proxy is
> what keeps renewals working, including for the `mail.`, `cpanel.` and `webmail.`
> service subdomains.

#### Symptom: language redirect goes to `http://localhost:4000/en`

Visiting `https://wizda.app/` (no locale in the path) redirects to
`http://localhost:4000/en` instead of `https://wizda.app/en`, while visiting
`https://wizda.app/en` directly works fine.

Root cause is in Next.js itself, not Apache: `next-server.js`'s
`attachRequestMeta` builds every absolute URL the server constructs internally
as `${protocol}://${fetchHostname}:${port}${req.url}` whenever `next start` was
given **both** an explicit hostname and port — which section E's
`-p 4000 -H 127.0.0.1` always is, precisely because loopback-only binding is a
hard requirement (see "Security: network exposure"). That branch ignores the
incoming `Host`/`X-Forwarded-Host` header entirely, so `request.url` inside
`middleware.ts` resolves to the bind address, not the public one — no Apache
header (`ProxyPreserveHost`, `X-Forwarded-*`) can override it, and dropping
`-H` to fix it would reopen the exact port exposure that flag exists to close.
Direct requests to `/en` never hit this path because no absolute URL needs
building — only middleware's locale redirect does.

Fixed in `packages/web-client/src/middleware.ts`: the redirect's origin is
built from `X-Forwarded-Host`/`X-Forwarded-Proto` directly instead of
`request.url`/`request.nextUrl.origin`. The `X-Forwarded-Proto` header above is
still worth keeping — Apache's mod_proxy sends `X-Forwarded-Host`
automatically but not `X-Forwarded-Proto`, and the middleware falls back to
`https` only when `X-Forwarded-Host` is present at all.

#### Symptom: `cpanel.wizda.app` is broken by the catch-all

Both failure modes below come from the same root cause, and the error text tells
you which one you are in. Common to both:

1. Wildcard DNS `*.wizda.app` resolves the hostname to the server.
2. cPanel's `ServerAlias cpanel.wizda.app` places the request in the **wizda.app**
   vhost.
3. cPanel rewrites the URI to `/___proxy_subdomain_cpanel/…` and expects its own
   `ProxyPass` to forward it to `127.0.0.1:2083`.
4. Our `proxy.conf` is included *ahead of* cPanel's directives, so whatever we
   say about that path wins — first match wins, and cPanel never gets a look in.

**A styled Next.js 404** — nothing in `proxy.conf` mentions the path, so
`ProxyPass /` forwarded it to the Node app on :4000, which has no such route.

**Apache's plain `Not Found`, with "additionally, a 403 Forbidden error was
encountered while trying to use an ErrorDocument"** — `proxy.conf` excludes the
path with `!`. That is worse, not better: `!` means "do not proxy this", so
cPanel's forwarding is suppressed and Apache tries to serve the path from the
document root, where no such directory exists. **This is why the paths must be
proxied explicitly rather than excluded.**

Apply the config above, then:

```bash
/scripts/rebuildhttpdconf && systemctl restart httpd
```

Diagnostics, if it still misbehaves. What matters is not just whether cPanel's
directives exist but *which directive type* they are and whether they land before
or after our include:

```bash
# Are cPanel's own proxy-subdomain directives in the built vhost, and where?
grep -n "proxy_subdomain\|userdata" /etc/apache2/conf/httpd.conf

# Is the service actually listening on the port we proxy to?
curl -sk -o /dev/null -w '%{http_code}\n' https://127.0.0.1:2083/

# Is our file being picked up at all?
httpd -S 2>&1 | grep -i wizda
```

If `grep` finds no `proxy_subdomain` lines at all, proxy subdomains are disabled
in WHM » Server Configuration » Tweak Settings » Domains. The explicit `ProxyPass`
above still works in that case — but the rewrite that maps `cpanel.wizda.app` onto
the path would be gone too, so enable the setting rather than hand-rolling it.

Fallbacks that bypass Apache entirely and stay reliable regardless:
`https://wizda.app:2083` (cPanel), `:2087` (WHM), `:2096` (webmail). Also
unaffected is `mail.wizda.app` **for SMTP/IMAP**, which never touches Apache —
note that the same hostname *in a browser* is a webmail proxy subdomain and does
go through the vhost.

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

**Taxonomy drift is not a failure.** If the upstream equipment CSVs use a `Type`,
`Armor Type` or `Rank` we don't map — most likely after a game update adds gear —
the seed still completes, still clears the maintenance flag, and prints an
`ACTION REQUIRED` block at the very end naming the unmapped values. The affected
items are stored without that one field. Work through "Adding a new equipment
category" in `docs/domain.md`, then re-seed so they pick the new codes up.
