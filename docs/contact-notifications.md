# Book Website contact form

Activated October 26, 2026. Public entry: `contact.html`.

- Firebase project: `hearttoheart-14e56`, shared with the main and support websites.
- Callable HTTPS function: `submitBookContact` in `us-central1`.
- Recipient: `hthlifecoaching@gmail.com`; existing verified sender and `SMTP_URL` Secret Manager secret reused without reading, copying, or replacing the SMTP secret.
- Independent `book-contact` codebase, `bookContactMessages` and `bookContactRateLimits` paths. No database rules or existing main/support functions changed.
- Notification copied from the support site's burgundy/cream HTML notification (the same design used by the main site). Header: **Book Website**. Includes name, email, optional phone, subject, message, Reply-To, reply button, and plain-text fallback.
- Messages are validated and rate-limited on the server. A request identifier prevents ordinary network retries from creating duplicate saved messages. Delivery is locked and recorded; failures tell the visitor that the message was saved but email delivery failed. SMTP acceptance followed by a connection failure can still lead to a duplicate email on a later retry.
- Database paths deny public access. Existing approved administrators can retry delivery through `retryBookContactEmail`, which also requires transport-layer permission. No new dashboard is included.
- The local preview sends real messages when a visitor submits the form. No automatic email is sent merely by opening the page.

## Verification

Seven automated tests cover validation, header injection, HTML escaping, notification contents, success handling, retained inputs/reused request identifier after network failure, and disabled configuration. Desktop and phone layouts inspected. The deployed callable rejected an empty invalid request with HTTP 400 and the correct CORS response. Public database reads were denied. All 14 prior functions retained their source hashes and environment settings.

No real test email was sent and inbox delivery/rendering has not been inspected. The existing mail service is reused; notification content was rendered locally using fictional data.

Summary evidence: `contact-deployment-verification.json`.

## Future deployments

Only deploy this codebase: `firebase deploy --only functions:book-contact --project hearttoheart-14e56`. Never deploy or delete the other codebases from this repository. Never deploy database-rule templates over the shared project.

The local ignored environment file holds the non-secret database/recipient/sender settings. See `functions/.env.example`; never put an SMTP secret in it.

If the CLI's function discovery times out, generate a fresh ignored manifest from current source inside `functions/`:

```sh
FUNCTIONS_CONTROL_API=true FUNCTIONS_MANIFEST_OUTPUT_PATH="$PWD/functions.yaml" node node_modules/firebase-functions/lib/bin/firebase-functions.js .
```

Deploy, then remove the generated manifest. Do not commit a stale `functions.yaml`.

Use GitHub Desktop for all commits and pushes, as recorded in AGENTS.md.
