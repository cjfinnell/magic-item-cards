# Magic Item Cards

Shareable, embeddable cards for every magic item in the D&D 5e System Reference Document 5.2.

- `/` - search and filter all SRD magic items
- `/i/<slug>` - full card page with copy-paste embed code
- `/embed/<slug>` - bare card for an `<iframe>`
- `/api/items`, `/api/items/<slug>` - JSON (CORS open)

Runs as a single Cloudflare Worker with static assets. No database.

## Develop

```sh
npm install
npm test        # builds src/items.gen.json, runs node:test suites
npm run dev     # wrangler dev on http://localhost:8787
```

## Deploy

GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)) runs `npm test` on every
push and PR. Every push to `main` then runs `npx wrangler deploy` to production.
The job needs the repo secret `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit).

## Data and licensing

- Code: MIT, see [LICENSE](LICENSE).
- Item text: `data/srd/5e-SRD-Magic-Items.json`, from [5e-bits/5e-database](https://github.com/5e-bits/5e-database)
  (MIT) at commit `6c7f2ed`, `src/2024/en`. See [NOTICE](NOTICE).

This work includes material from the System Reference Document 5.2 ("SRD 5.2") by
Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2 is
licensed under the Creative Commons Attribution 4.0 International License, available at
https://creativecommons.org/licenses/by/4.0/legalcode. Not affiliated with or endorsed by
Wizards of the Coast. Only SRD content may be added to this repo.
