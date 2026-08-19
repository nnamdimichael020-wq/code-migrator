# CodeShift AI

## Feedback email configuration

The feedback form sends through Resend at runtime. Configure these Cloudflare Worker secrets before expecting delivery:

- `DEVELOPER_EMAIL` — destination inbox.
- `RESEND_API_KEY` — Resend API key.
- `RESEND_FROM_EMAIL` — optional verified sender, for example `CodeShift AI <no-reply@example.com>`. Without it, the code uses Resend's `onboarding@resend.dev` testing sender, which is restricted by Resend.

The API returns `ok: true` only after Resend accepts the message. Provider failures are logged server-side and returned as an error; no secrets belong in this repository.
