# Stripe Billing Setup — click-by-click for CodeShift AI

This turns "Go Pro" into a real $7/month payment page. You will:

1. Merge the code (already written and tested — you just click Merge)
2. Create a free Stripe account in **Test mode**
3. Copy 3 values out of Stripe into Cloudflare
4. Run one fake $7 payment with a test card to prove it all works

No real money moves at any point in this guide. Time: ~25–35 minutes.
Keep your VPN off throughout.

---

## Step 0 — Before you start (2 checks)

**Check A: Is the billing code live?**
The payment code sits in PR #9 and is NOT on your live site until you merge it.
Open: https://github.com/nnamdimichael020-wq/code-migrator/pull/9
If it says "Merge pull request" → do it now, then go to Cloudflare → Workers &
Pages → code-migrator → Deployments and wait for the newest build to go green
(your usual routine). Do the Stripe steps below only AFTER it is green —
Stripe will try to reach the webhook URL, and it only exists once this deploys.

**Check B: Does Google sign-in work?**
Payments need login. Quick test on https://code-migrator.nnamdimichael020.workers.dev:
click **Go Pro ($7)**.
- If you land on a Google "choose an account" page → sign-in is configured. Done with Check B.
- If you see an error like *"Google Sign-In is not configured yet"* → the four
  OAuth secrets (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SESSION_SECRET,
  APP_BASE_URL) were never added. Stop here and do that first — it was the
  "GUIDE-GOOGLE-AUTH" setup from earlier (Google Cloud Console → OAuth client
  with redirect URI `https://code-migrator.nnamdimichael020.workers.dev/api/auth/google/callback`,
  then the 4 secrets in Cloudflare). Ask me and I'll walk you through it again.

---

## Step 1 — Create the Stripe account (5 min)

1. Go to https://stripe.com → click **Start now** (top right).
2. Sign up with your email and a password (or "Continue with Google").
   Use the same Gmail you use for everything else on this project.
3. Stripe may ask for country / business details — you can click **Skip** /
   leave it incomplete. **None of that matters for Test mode.** You only need
   it months from now if you activate real payments.
4. You land on the Stripe Dashboard.

**THE MOST IMPORTANT SWITCH:** top-right of the dashboard there is a toggle
labelled **Test mode**. Click it ON. The whole dashboard now shows a
"Test data" banner / orange tint. Everything you copy in this guide MUST be
copied while this switch is ON — test values start with `sk_test_`, and the
fake card only works in this mode.

> Keep Test mode ON for ALL of Steps 2–5 and the test in Step 7.

---

## Step 2 — Copy your test secret key (2 min)

1. Still in **Test mode**: left sidebar → **Developers** (the </> icon) →
   **API keys**.
2. Find the row **Secret key** → click **Reveal test key** (or "Reveal").
3. You'll see a value starting with `sk_test_`.
4. Open Notepad. Paste it under the label `STRIPE_SECRET_KEY`.

Security rule (same as always): Notepad only. Never in GitHub, never in chat.

---

## Step 3 — Create the $7/month product and copy its price ID (5 min)

1. Still in **Test mode**: left sidebar → **Product catalog** (or "Products").
2. Click **+ Add product**.
3. Fill in:
   - **Name**: `CodeShift Pro`
   - **Description** (optional): `Unlimited daily conversions and scripts up to 500 lines`
   - **Pricing**: click **Recurring** (not One time)
     - Price: `7.00` USD
     - Billing period: **Monthly**
4. Click **Save product**.
5. You're now on the product's page. Scroll to the **Pricing** section — there
   is a table row with an ID that starts with `price_` (e.g. `price_1Pxyz...`).
   Hover it, click to **copy** it.
6. Paste it into Notepad under the label `STRIPE_PRICE_ID`.

---

## Step 4 — Create the webhook (the thing that flips accounts to Pro) (5 min)

The webhook is Stripe calling your site when money events happen. Ours:
when payment completes → set the account to Pro; when the subscription dies →
back to free.

1. Still in **Test mode**: **Developers** → **Webhooks**.
2. Click **+ Add endpoint** (newer dashboards may say **Add destination** —
   same thing).
3. **Endpoint URL** — paste exactly, no spaces:
   ```
   https://code-migrator.nnamdimichael020.workers.dev/api/billing/webhook
   ```
4. **Description**: `CodeShift Pro billing`.
5. Under **Select events** (may be a button "Select events" → "Select types"):
   type into the search box and tick exactly these three:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click **Add endpoint**.
7. You're now on the endpoint's page. Find **Signing secret** → click
   **Reveal** → copy the value starting with `whsec_`.
8. Paste into Notepad under `STRIPE_WEBHOOK_SECRET`.

If Stripe shows a warning that the endpoint didn't respond — it means Step 0's
deploy wasn't green yet. Finish the deploy, then come back and click
**"Send test webhook"** on this page; it should show a 200 response.

---

## Step 5 — Put the 3 values into Cloudflare (3 min)

Cloudflare dashboard → **Workers & Pages → code-migrator → Settings →
Variables and secrets** → **Add** one at a time (Type: **Secret** each time):

| Name | Value from Notepad |
|---|---|
| `STRIPE_SECRET_KEY` | the `sk_test_...` one |
| `STRIPE_WEBHOOK_SECRET` | the `whsec_...` one |
| `STRIPE_PRICE_ID` | the `price_...` one |

While you're there, confirm a variable named **APP_BASE_URL** already exists
with value `https://code-migrator.nnamdimichael020.workers.dev` (no trailing
slash) — you added it during the Google sign-in setup. If it's missing, add it
as Text. Do not delete any existing variables.

Secrets apply without a rebuild. No need to redeploy.

---

## Step 6 — Open a Notepad page called "receipts" (skip if you like)

Nothing to do — just noting: every test payment also sends an email to the
buyer's inbox in test mode? No — test mode sends no emails. Real receipts only
exist in live mode. Moving on.

---

## Step 7 — The full test run (10 min)

Now the satisfying part. On https://code-migrator.nnamdimichael020.workers.dev:

1. Hard refresh: **Ctrl + Shift + R**.
2. Click **Go Pro ($7)** → Google sign-in → you land on the Pro page.
   You should now see **"Upgrade to Pro"** and a button
   **"Continue to payment — $7/month"** (NOT "coming soon" — that text is gone).
3. Click **Continue to payment**. A Stripe-hosted checkout page opens.
   Top of the page shows a test-mode banner with a **"Fill test card details"**
   button — you can click that instead of typing the card.
4. Card details:
   - Email: prefilled with your Gmail
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date, e.g. `12 / 34`
   - CVC: any 3 digits, e.g. `123`
   - Name: anything
5. Click **Subscribe / Pay $7.00**.
6. You bounce back to **/pro/success** → it should say **"You're on Pro"**
   with your email.
7. Verify everything:
   - Header now shows a green **Pro** badge (where Go Pro used to be) and
     **"Conversions: unlimited (Pro)"**
   - Convert something 4+ times — never blocked
   - Paste a 300-line script — it converts (free tier correctly refuses that)
   - Visit `/api/auth/me` — shows `"plan": "pro"`
8. In the Stripe dashboard (Test mode): **Payments** shows a $7.00 test
   payment; **Subscriptions** shows an active subscription;
   **Developers → Webhooks** → your endpoint → deliveries showing **200**.

## Step 8 — Test the cancel path (3 min, optional but recommended)

1. Stripe (Test mode) → **Subscriptions** → click the test subscription →
   **Cancel subscription** → **Cancel immediately**.
2. Wait ~10 seconds, refresh the CodeShift site (Ctrl + Shift + R).
3. Header is back to **Go Pro ($7)** and `/api/auth/me` shows
   `"plan": "free"`. That's the webhook flipping the account back — exactly
   what happens when a real subscriber cancels.

---

## Troubleshooting

| What you see | What it means | Fix |
|---|---|---|
| /pro says "Pro checkout is almost ready" | One of the 3 secrets is missing/misspelled, or PR #9 isn't deployed | Check exact names in Cloudflare; confirm newest deployment is green |
| "Could not start checkout" + a Stripe error | The 3 values are mixed from different modes (e.g. live price with test key) | Re-copy ALL three while Test mode is ON |
| Success page stuck on "activating Pro" | Webhook secret wrong (usually copied from the other mode) or endpoint URL typo | Stripe → Webhooks → check deliveries for non-200; re-copy the whsec_ |
| "Sign in with Google first" after clicking pay | Your login session expired mid-flow | Click Go Pro again, sign back in |
| Go Pro → "not configured yet" error | Google OAuth secrets were never set (Step 0, Check B) | Do the Google setup first |
| Stripe checkout says card declined | You typed the card in LIVE mode, or a non-test card | Go back, ensure Test mode is ON, use 4242… |

---

## Going live with real money — read this before you get excited

Test mode is free and works forever. **Live mode is where it gets honest:**

- Stripe does **not** open accounts for businesses registered in Nigeria.
  Activating live payouts requires a company + bank in a Stripe-supported
  country (the common route is registering a US LLC, ~$300–500 via services
  like Firstbase or Stripe Atlas, plus a US business bank account).
- Do NOT activate live mode using someone else's account or fake details —
  Stripe freezes funds when it detects that.
- When you're ready for real money you have two honest options:
  1. Register a US/UK company and use its Stripe account (swap the three
     secrets for live values — nothing else changes), or
  2. Ask me to swap the payment provider to one that supports Nigerian
     businesses natively (Paystack, Flutterwave, or Lemon Squeezy). All the
     Stripe code lives in one file (`lib/billing.js`), so a swap is contained.

Until then: leave everything in Test mode. The whole product flow — checkout,
Pro badge, unlimited conversions, cancel → free — is real and proven; only the
money is fake. That's the right state for a product still gathering testers.
