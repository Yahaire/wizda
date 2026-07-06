# Deployment (cPanel + AlmaLinux)

This guide covers deploying to a cPanel VPS on AlmaLinux using two subdomains —
one for the frontend and one for the backend API — with PostgreSQL installed
directly on the server.

Replace the placeholders below with your own values:

- `<domain>` — your base domain (e.g. `example.com`)
- `<app>.<domain>` — the frontend subdomain
- `api.<app>.<domain>` — the backend API subdomain
- `<username>` — your cPanel account username

### Prerequisites

- VPS cPanel account on AlmaLinux with SSH and root access
- `ea-nodejs22` installed via WHM → EasyApache 4
- Two subdomains configured: `<app>.<domain>` and `api.<app>.<domain>`
- A git remote (GitHub, GitLab, etc.) the server can clone from

### A. Node.js Symlinks (via SSH, one-time)

EasyApache installs Node.js outside the system PATH. Symlink the binaries so all tools work without full paths:

```bash
ln -s /opt/cpanel/ea-nodejs22/bin/node /usr/local/bin/node
ln -s /opt/cpanel/ea-nodejs22/bin/npm /usr/local/bin/npm
ln -s /opt/cpanel/ea-nodejs22/bin/npx /usr/local/bin/npx
ln -s /opt/cpanel/ea-nodejs22/bin/pm2 /usr/local/bin/pm2
```

> The last symlink for `pm2` can only be created after installing PM2 in step D.

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

Create a `.env` file in the repo root on the server (e.g. `~/repos/wizda/.env`):

```
DATABASE_URL="postgresql://<username>_wizda_user:yourpassword@localhost:5432/<username>_wizda"
WEB_CLIENT_URL="https://<app>.<domain>"
API_URL="https://api.<app>.<domain>"
JUNK_DROP_RATES_SOURCE_URL="https://wizardry.info/daphne/gacha_rates/en/equipments.html"
```

### D. cPanel Git Version Control

1. cPanel → **Git Version Control** → **Create**
2. Set **Clone URL** to your GitHub/GitLab repo URL
3. Set **Repository Path** to e.g. `/home/<username>/repos/wizda`
4. Create the repository

The `.cpanel.yml` file in the repo root runs `npm install` automatically after each deploy. The build step cannot run in cPanel's deploy environment (see `.cpanel.yml` for details), so the build and restart must be done manually via SSH after deploying (see section H).

### E. PM2 Setup (via SSH, one-time)

PM2 keeps the Node.js processes alive and restarts them on server reboot.

```bash
npm install -g pm2
```

Start both apps:

```bash
cd ~/repos/wizda

# Backend API (port 3001)
pm2 start packages/backend-api/dist/backend-api/src/index.js --name wizda-api

# Frontend (port 3000)
pm2 start node_modules/next/dist/bin/next --name wizda-web -- start packages/web-client -p 3000
```

Save and configure PM2 to start on boot:

```bash
pm2 save
pm2 startup
# Run the command it prints, then run pm2 save again
```

### F. Apache Reverse Proxy (via SSH, one-time)

Create a config file for each subdomain:

```bash
nano /etc/apache2/conf.d/userdata/ssl/2/<username>/<app>.<domain>/proxy.conf
```

Contents:

```apache
ProxyPass / http://127.0.0.1:3000/
ProxyPassReverse / http://127.0.0.1:3000/
```

```bash
nano /etc/apache2/conf.d/userdata/ssl/2/<username>/api.<app>.<domain>/proxy.conf
```

Contents:

```apache
ProxyPass / http://127.0.0.1:3001/
ProxyPassReverse / http://127.0.0.1:3001/
```

Then rebuild and restart Apache:

```bash
/scripts/rebuildhttpdconf
systemctl restart httpd
```

> **Note:** The `ssl/2` path is for HTTPS (port 443). If the directories don't exist yet, create them with `mkdir -p`.

### G. First-Time Database Setup (via SSH, one-time)

```bash
cd ~/repos/wizda
npx prisma migrate deploy
npx prisma db seed
```

### H. Subsequent Deployments

#### Code updates

For code changes (including schema migrations):

1. Push commits to your git remote
2. cPanel → Git Version Control → **Deploy HEAD Commit**
   - This pulls the latest code and runs `npm install` automatically
3. SSH into the server and run:

```bash
cd ~/repos/wizda
npx prisma migrate deploy
npm run build
pm2 restart all

# Single line version (if you're confident it'll run)
cd ~/repos/wizda && npx prisma migrate deploy && npm run build && pm2 restart all
```

#### Data updates

When the source pages change or the scraper/seed logic changes, re-seed without redeploying code:

```bash
cd ~/repos/wizda
npm run db:seed:maintenance
```

This sets a maintenance flag before seeding and clears it on success. If the seed fails, the flag is left in place intentionally — the DB may be in a partial state, so it's safer to keep the maintenance page up until you fix the issue and re-run. To clear it manually (e.g. after a killed process):

```bash
rm .maintenance
```
