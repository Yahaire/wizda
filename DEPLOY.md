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

These symlinks are for interactive SSH sessions only. Neither cPanel's deploy task nor cron loads the login profile, and cron's `PATH` is just `/usr/bin:/bin`, so `/usr/local/bin` is not on it either. The scripts in `deployment-tools/` put `/opt/cpanel/ea-nodejs22/bin` on their own `PATH` (`NODE_BIN_DIR` in `deployment-tools/.env` if that folder ever changes), which is why both automated paths go through them — see sections D and I.

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

The `.cpanel.yml` file in the repo root makes *Deploy HEAD Commit* run `deployment-tools/deploy.sh`, which installs, builds, migrates the database and restarts the pm2 processes — the whole update, no SSH needed (see section H). It needs the root `.env` from section C and, for the build to fit, a high enough "Max cPanel process memory" (see "Things to know").

Optionally, create `deployment-tools/.env` from `deployment-tools/env.example` to override the script's defaults (pm2 process names, web port, Node location). The defaults match this guide, so it is not needed on a server set up as described here.

### E. PM2 Setup (via SSH, one-time)

PM2 keeps the Node.js processes alive and restarts them on server reboot.

```bash
npm install -g pm2
pm2 startup
# Run the command it prints
```

The processes themselves are started by the first deploy (section G): `deploy.sh` starts any pm2 process that does not exist yet and restarts the ones that do, then runs `pm2 save` so the boot list stays current. For reference, these are the commands it uses, with the defaults from `deployment-tools/env.example`:

```bash
# Backend API (port from PORT in .env, binds 127.0.0.1 by default)
pm2 start packages/backend-api/dist/backend-api/src/index.js --name wizda-api

# Frontend (port 4000, forced onto 127.0.0.1)
pm2 start node_modules/next/dist/bin/next --name wizda-web -- start packages/web-client -p 4000 -H 127.0.0.1
```

Note `-H 127.0.0.1` on the frontend — it keeps the Next.js port loopback-only (see "Security: network exposure"); the API binds loopback on its own. Different names or ports go in `deployment-tools/.env` (`API_PROCESS_NAME`, `WEB_PROCESS_NAME`, `WEB_PORT`, `WEB_HOST`), never into a hand-run `pm2 start`, or the next deploy would start a second copy under the default name.

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

### G. First Deploy and Database Setup (one-time)

1. cPanel → Git Version Control → **Manage** → **Pull or Deploy** → **Deploy HEAD Commit**. This runs `deployment-tools/deploy.sh`: it installs, builds, creates the database tables (`prisma migrate deploy`) and starts both pm2 processes. The output is in the deployment log (cPanel → Git Version Control → the repository's log, kept under `~/.cpanel/logs/`).

2. Seed the data, over SSH:

   ```bash
   cd ~/repositories/wizda
   bash deployment-tools/seed.sh
   ```

   This is `npm run db:seed:maintenance` with the environment set up around it. It loads all four sources from section C and wipe-and-rebuilds the tables (see `docs/domain.md`) behind a `.maintenance` flag that clears on success. It is idempotent — safe to re-run. (There's no root `npm run seed`; the underlying script lives in the `backend-api` workspace and is invoked by Prisma via `prisma.config.ts`.)

3. Schedule the weekly re-seed (section I).

### H. Subsequent Deployments

#### Code updates

For code changes (including schema migrations), after pushing to the remote, in cPanel → Git Version Control → **Manage** → **Pull or Deploy**:

1. **Update from Remote** (fast-forwards the clone).
2. **Deploy HEAD Commit** — runs `.cpanel.yml`, which runs `deployment-tools/deploy.sh`.

Over SSH, the equivalent is the same script:

```bash
cd ~/repositories/wizda
git pull
bash deployment-tools/deploy.sh
```

The script's output goes to the deployment log (`~/.cpanel/logs/`). A deploy takes a few minutes, nearly all of it the build. It stops at the first step that fails:

1. Checks its setup: the root `.env` exists, `npm` and `pm2` are found, and logs the virtual memory limit (refusing to build below `MIN_VM_LIMIT_GB`, if that is set — see "Things to know").
2. Runs `npm ci`, or skips it and reuses `node_modules/` when `package-lock.json` hasn't changed since the last successful install.
3. Runs `npm run build` (shared, `prisma generate`, API, web) and checks the two build outputs exist.
4. Runs `npx prisma migrate deploy`. After the build on purpose: a failed build then leaves the database at the version the running code expects.
5. Restarts `wizda-api` and `wizda-web` (starting whichever doesn't exist yet) and runs `pm2 save`.
6. Waits up to a minute for both to answer on their ports, then prints `pm2 ls`.

The apps are built in place, so between the start of the build and the restart the live site may answer some requests with errors (the running `next start` serves from the `.next/` folder the build is rewriting). That window is the build's length; a failed build leaves the previous processes running on a possibly inconsistent `.next/`, so after fixing the cause, deploy again rather than leaving it.

A code update does not re-seed. If the commit changed the scraper or the seed, follow it with a data update.

#### Data updates

When the source pages change or the scraper/seed logic changes, re-seed without redeploying code:

```bash
cd ~/repositories/wizda
bash deployment-tools/seed.sh
```

This sets a maintenance flag before seeding and clears it on success. If the seed fails, the flag is left in place intentionally — the DB may be in a partial state, so it's safer to keep the maintenance page up until you fix the issue and re-run. To clear it manually (e.g. after a killed process):

```bash
rm .maintenance
```

A deploy that finds the flag warns about it in its log and carries on; the flag is the seed's to clear, not the deploy's.

### I. Scheduled Data Updates (cron, one-time)

The upstream pages change with the game, so the seed runs weekly from cPanel → **Cron Jobs**. The job must call `deployment-tools/seed.sh`, not `npm` directly:

```
0 3 * * 4 mkdir -p $HOME/logs && /bin/bash $HOME/repositories/wizda/deployment-tools/seed.sh >> $HOME/logs/wizda-seed.log 2>&1 || echo "Seed failed; see $HOME/logs/wizda-seed.log"
```

Why the wrapper: cron runs jobs with `PATH=/usr/bin:/bin` and no login profile, so a plain `cd ~/repositories/wizda && npm run db:seed:maintenance` dies at `npm: command not found` every time — while the same command works from an SSH shell, whose profile has `/usr/local/bin` and the section A symlinks. The failure is silent unless someone reads the account's local mail (`mail`, or `/var/spool/mail/<username>`), which is where cron sends a job's output when the Cron Jobs page has no email set. `seed.sh` puts `/opt/cpanel/ea-nodejs22/bin` on its own `PATH` and logs with timestamps. With the line above, each run appends to `~/logs/wizda-seed.log`, and only a failure produces output — so if the Cron Jobs page has an email set, a failure sends one line and a success sends nothing.

The visible check is the "Updated … ago" label on the site, which comes from the seed's timestamp: with the job working it never reads more than a week.

Deploys and seeds take a lock (`~/.wizda-tasks.lock`) so one started while the other runs waits for it instead of rebuilding the database under a build.

**Taxonomy drift is not a failure.** If the upstream equipment CSVs use a `Type`,
`Armor Type` or `Rank` we don't map — most likely after a game update adds gear —
the seed still completes, still clears the maintenance flag, and prints an
`ACTION REQUIRED` block at the very end naming the unmapped values. The affected
items are stored without that one field. Work through "Adding a new equipment
category" in `docs/domain.md`, then re-seed so they pick the new codes up.

### Things to know

- **"Max cPanel process memory" must be high enough for the build.** cPanel runs the deploy task under that WHM → *Tweak Settings* limit, and it caps *virtual address space* (`ulimit -v`), not the memory actually used: Node reserves far more address space than it touches, and both the Prisma CLI and Next's compiler run WebAssembly, which reserves more still. Under a too-tight cap the build doesn't fail cleanly: it thrashes the garbage collector for many minutes, then aborts with errors like `JavaScript heap out of memory` or `WebAssembly.Instance(): Out of memory`. `deploy.sh` lifts the soft limit to the hard one, logs the result on every run, and passes `--disable-wasm-trap-handler` to Node so each WebAssembly instance reserves only what it uses. Once the number this build needs on this server is known, set `MIN_VM_LIMIT_GB` in `deployment-tools/.env` so a lowered limit fails fast instead of thrashing.
- **Never edit tracked files in the clone on the server.** *Deploy HEAD Commit* needs a clean working tree. `.env` (root and `deployment-tools/`), `.maintenance`, `node_modules/`, `dist/`, `.next/` and `*.log` are gitignored, so they don't count.
- **To force a clean reinstall of dependencies**, delete `node_modules/` in the clone, then deploy. Deploys otherwise reinstall only when a pulled commit changes `package-lock.json`.
- **Node.js comes from `/opt/cpanel/ea-nodejs22/bin`** inside the scripts, because neither the deploy task nor cron loads the login profile's PATH. If cPanel's Node.js package changes (e.g. to `ea-nodejs24`), set `NODE_BIN_DIR` in `deployment-tools/.env`.
- **`pm2 restart` keeps the environment from the first `pm2 start`.** That is fine for the API, which reads the root `.env` itself, and for `API_URL`, which the web build bakes in (section C). It also means the build-only `NODE_OPTIONS` never reaches the apps.
