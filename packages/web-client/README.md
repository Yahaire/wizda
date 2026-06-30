# wizda web-client

Next.js web client for wizda. Part of the monorepo — see the root README for running (`npm run dev:web-client`).

Currently a minimal hello-world placeholder. The UI will be built out once the API is ready.

## Troubleshooting

**Editor reports `Cannot find module or type declarations for side-effect import of './globals.css'`?**

The editor is probably using its bundled TypeScript instead of the workspace version. Point it at the workspace TS: Command Palette → "TypeScript: Select TypeScript Version" → "Use Workspace Version". The repo's `.vscode/settings.json` does this automatically on editors that support `js/ts.tsdk.*`.
