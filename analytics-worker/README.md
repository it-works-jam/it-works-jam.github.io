# JamHub anonymous analytics

The Worker stores aggregate counters only. A row contains a five-minute UTC bucket,
an event type, a page path, an optional build path, and a count. It does not store or
derive IP addresses, user agents, referrers, cookies, session IDs, or fingerprints.

## Commands

```sh
npm install
npm test
npm run db:init:local
npm run dev
npm run db:init:remote
npx wrangler secret put STATS_TOKEN
npm run deploy
```

`ALLOWED_ORIGINS` and the D1 binding live in `wrangler.jsonc`. The production stats
token is a Cloudflare secret and must never be committed.

The scheduled handler removes aggregate buckets older than 93 days.
