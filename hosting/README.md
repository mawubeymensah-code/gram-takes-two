# Gram Takes Two hosted application

This deployment adapts the existing website to the Sites Cloudflare Workers runtime with Vinext route handlers and persistent D1 storage. The original Node.js/SQLite server remains in the GitHub repository root.

The homepage, event filters, membership interest, and contact forms retain their design. Forms save submissions; they do not send email. No dates were invented: public/events.json is empty until a confirmed schedule is supplied.

## Checks

Use Node.js 24 and the package manager recorded in package.json. Run pnpm install --frozen-lockfile, node --test tests/forms.test.mjs, pnpm exec tsc --noEmit, and pnpm run build.

The four adapter tests cover saved submissions, protected export, validation, body limits, persistent rate limits, honeypot behavior, and literal storage of Unicode and SQL-like text. They exercise SQLite using the committed generated schema behind an injectable D1 adapter.

## Hosted database and access

The hosting manifest declares a DB D1 binding. Sites provisions storage and applies the committed Drizzle migrations during deployment. Never create schema tables in request handlers.

New publication is owner-private. The organizer export at GET /api/admin/submissions is disabled until a server-only GRAM_ADMIN_TOKEN of at least 32 characters is configured in hosting secrets. The browser never receives the token. Export is capped at the newest 500 rows. Rate identifiers are hashed and old counters expire after 24 hours.

Establish an organizer review and retention policy before collecting real submissions. Email delivery and verified event details require organization setup.

## Source

The platform build/runtime integration and its licensed template dependencies are retained. The public GitHub repository includes this deployment version under hosting/.
