# Gram Takes Two

**A place to belong.** A responsive organization website for a student-led community in Grambling, Louisiana, with event information, membership interest, and community contact forms.

## Working features

- Responsive homepage, community introduction, event categories, membership interest, and contact sections.
- Events loaded from a validated local JSON file, sorted by date and displayed in Central Time. Past events are excluded.
- Membership and contact forms with client/server validation, consent, useful feedback, and disabled duplicate-click submissions.
- Node.js HTTP API and SQLite persistence: form responses are actually saved for organizer review.
- Optional bearer-protected organizer JSON export. The browser never receives the organizer token.
- Same-origin submission enforcement, a honeypot, an in-memory IP rate limit, body-size limits, prepared SQL statements, and security headers.
- Accessible labels, keyboard focus, a skip link, reduced-motion support, live feedback, and empty/error states.

## Run locally

Requires **Node.js 24+** for the built-in SQLite module. There are no npm dependencies.

```bash
npm start
```

Open `http://localhost:3001`. Submissions are stored in ignored `data/submissions.sqlite`. The forms work without email-provider credentials. **They do not send emails**; success messages explicitly say the responses are saved for review.

Configuration variables are listed in `.env.example`. Set them in the process environment; the application does not automatically load `.env` files. You may also use Node's `--env-file` with an ignored local file.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port, default 3001 |
| `GRAM_DB_PATH` | Persistent SQLite path, default `data/submissions.sqlite` |
| `GRAM_ADMIN_TOKEN` | Optional random secret of at least 32 characters; enables organizer export |
| `GRAM_PUBLIC_ORIGIN` | Exact HTTPS origin when deployed behind a proxy, without a trailing slash |

## Organizer review

Generate a long random token through your secret manager and supply it as `GRAM_ADMIN_TOKEN`. From an organizer-controlled client, request `GET /api/admin/submissions` with `Authorization: Bearer <your-token>`. The response includes membership/contact records in newest-first order. Without a configured token, this endpoint is disabled with a 401 response. Do not embed the token in frontend code or share exports publicly. Treat exported names/emails/messages as private information.

The application has no browser-based admin dashboard or automated organizer email delivery. It does not guarantee a response to submissions.

## Add real events

`public/events.json` currently contains an empty array because no verified event schedule was supplied. The website shows an honest announcement-pending state. Replace it with verified records using this schema, then restart the server:

```json
[
  {
    "id": "unique-event-slug",
    "title": "Your verified event title",
    "description": "Your verified event details",
    "location": "Your confirmed location",
    "category": "Community",
    "start": "2027-01-01T18:00:00-06:00"
  }
]
```

The example above is **schema documentation, not an announced event**. Categories are `Community`, `Service`, or `Social`; timestamps need a timezone. No dates, officer names, contact inboxes, testimonials, or membership counts are fabricated.

## Checks

```bash
npm run check
npm test
```

Tests exercise real HTTP requests and SQLite writes: valid forms, invalid email/consent/length, SQL-injection-resistant storage, origin rejection, body limits, honeypot, rate limiting, protected export, restart persistence, event output, and private-file denial. A configured GitHub Actions workflow runs the checks after upload.

## Deployment and remaining work

This source is a **local implementation, not a deployed organization site**. Deploy on a Node.js host with HTTPS and a persistent disk, set `GRAM_DB_PATH` to that disk, and back up the database. An ephemeral/serverless filesystem will lose submissions. The direct Node/SQLite server does not run on the Sites Cloudflare Workers runtime without a storage/server adaptation.

Before collecting real submissions, establish organizer access, privacy/retention policy, backups, and a review process. The local IP limiter is single-process and does not trust forwarded headers; add an appropriately configured edge limiter behind shared proxies or multiple instances. Email delivery, automated retention/deletion, and a browser admin dashboard remain unfinished. Real-browser visual and interaction QA has not been performed in this environment.


## Hosted private preview

[Open Gram Takes Two](https://gram-takes-two-mawubey.zany-llama-7991.chatgpt.site). Access is owner-private; this is not a publicly launched organization website.

The `hosting/` directory contains the deployed Vinext/Cloudflare Workers version. It preserves the existing design and saves forms in persistent D1 storage. Its four adapter tests pass, and the production build and deployment succeeded. The original Node/SQLite implementation remains in the repository root.

Email delivery, organizer export credentials, verified event details, and the organization's submission-retention policy still require setup. Private previews should not be linked as publicly accessible internship demos.
