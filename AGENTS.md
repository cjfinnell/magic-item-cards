# Agent notes

- Built and run by NanoClaw agents for Connor (cjfinnell).
- Push straight to `main` until MVP (Connor, 2026-10-23). No PRs yet.
- `main` deploys to production through Cloudflare Workers Builds. Run `npm test` before every push.
- Only SRD 5.2 (CC-BY-4.0) content. Never add non-SRD Wizards of the Coast text or art.
- Keep the CC-BY attribution on every rendered card and on the home page.
- Stack: one Worker (`src/worker.js`) plus static assets (`public/`). No framework, no build step beyond `scripts/build-data.mjs`.
