# deployment-tools

Everything the server runs on its own: the cPanel deploy and the weekly data refresh. **For setup, deploying and the cron job, see [DEPLOY.md](../DEPLOY.md)** at the repository root.

- `deploy.sh` — the deploy itself, run by `.cpanel.yml` on *Deploy HEAD Commit* (install, build, migrate, restart pm2, health check).
- `seed.sh` — the database re-seed, wrapped for cron. Same as `npm run db:seed:maintenance`, but it finds Node on its own.
- `common.sh` — what both share: PATH and HOME setup for environments that do not load the login profile, logging, and a lock so a deploy and a seed never overlap.
- `env.example` — this server's optional settings (process names, ports, where Node is). Copied to `.env` next to it, which is gitignored, so deploys never touch it. The app's own `.env` is the one at the repository root.
