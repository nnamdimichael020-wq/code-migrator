# Lemon Squeezy Billing Setup — click-by-click for CodeShift AI

Lemon Squeezy is the payment provider for CodeShift Pro ($7/month). It hosts
the card page for you (card numbers never touch your site), sends the
receipts, and — the reason we chose it over Stripe — it onboards founders in
Nigeria and pays out internationally.

What you'll do: merge the code → create a Lemon Squeezy account in **Test
mode** → copy 4 values into Cloudflare → run one fake $7 payment with the test
card. No real money moves. Time: ~30 minutes. VPN off.

---

## Step 0 — Two checks before anything

**Check A: is the billing code live?**
The payment code is in PR #9 and only reaches your site when you merge it:
https://github.com/nnamdimichael020-wq/code-migrator/pull/9 → **Merge pull
request** → Cloudflare → Workers & Pages → code-migrator → Deployments → wait
for green. The webhook URL below only exists after this deploy.

**Check B: does Google sign-in work?**
On https://code-migrator.nnamdimichael020.workers.dev click **Go Pro ($7)**.
If you get a Google account-picker → good. If you get "Google Sign-In is not
configured yet" → the OAuth secrets were never added; ask me and we'll do
that 10-minute setup first (payments need login).

---

## Step 1 — Create the Lemon Squeezy account (5 min)

1. Go to https://app.lemonsqueezy.com → **Sign up** (email + password).
2. It walks you through creating your **store** — store name: `CodeShift AI`.
   Country: Nigeria is fine; Lemon Squeezy accepts merchants globally.
3. You land in the dashboard. Skip/complete the "activate store" prompts —
   activation is only needed for REAL money later. Test mode works right now.

## Step 2 — Turn ON Test mode (1 min, the most important click)

1. In the dashboard find the **Test mode** switch — it sits with your store
   selector / under Settings, labelled "Test mode". Flip it **ON**.
2. While it's on, everything you see and create is **test data** (the
   dashboard labels it). All four values in this guide must be copied while
   Test mode is ON.

## Step 3 — Copy the API key (2 min)

1. Test mode ON → **Settings** → **API** → **+** (new key) → label it
   `codeshift-server` → create.
2. Copy the key into Notepad under `LEMON_SQUEEZY_API_KEY`.
   (Shown once — if you lose it, create another.)

## Step 4 — Find your Store ID (2 min)

1. **Settings** → **Stores** (or click the store selector).
2. Your store shows a numeric **ID** next to its name (also visible in the
   page URL). e.g. `152843`.
3. Paste into Notepad under `LEMON_SQUEEZY_STORE_ID`.

## Step 5 — Create the $7/month product and copy the Variant ID (5 min)

1. Test mode ON → **Products** → **+ New product**.
2. Name: `CodeShift Pro`. Description (optional): "Unlimited daily
   conversions and scripts up to 500 lines."
3. Pricing: **$7.00** → billing period **Monthly**.
4. Save. Open the product — the price row is a **variant** with its own
   numeric **ID** (click the ID to copy it).
5. Paste into Notepad under `LEMON_SQUEEZY_VARIANT_ID`.
   (Careful: this is the VARIANT id, not the product id — they differ.)

## Step 6 — Create the webhook (the thing that flips accounts to Pro) (5 min)

1. Test mode ON → **Settings** → **Webhooks** → **+ New webhook**.
2. Callback URL — paste exactly:
   ```
   https://code-migrator.nnamdimichael020.workers.dev/api/billing/webhook
   ```
3. **Signing secret**: Lemon Squeezy shows one automatically — copy it into
   Notepad under `LEMON_SQUEEZY_WEBHOOK_SECRET`.
4. Events: if there's a "send all events" option you may use it; otherwise
   tick exactly these five:
   - `subscription_created`
   - `subscription_updated`
   - `subscription_cancelled`
   - `subscription_expired`
   - `subscription_payment_success`
5. Save. (If the delivery log shows a failed test ping, the deploy from
   Step 0 wasn't green yet — finish it, then re-send.)

## Step 7 — Put the 4 values into Cloudflare (3 min)

Cloudflare → **Workers & Pages → code-migrator → Settings → Variables and
secrets** → Add each as type **Secret**:

| Name | Notepad label |
|---|---|
| `LEMON_SQUEEZY_API_KEY` | the API key |
| `LEMON_SQUEEZY_STORE_ID` | the store number |
| `LEMON_SQUEEZY_VARIANT_ID` | the variant number |
| `LEMON_SQUEEZY_WEBHOOK_SECRET` | the signing secret |

Also confirm **APP_BASE_URL** exists = `https://code-migrator.nnamdimichael020.workers.dev`
(you added it during the Google setup). If you ever added any `STRIPE_*`
secrets while following the old guide, delete them — they're unused now.
Secrets apply without a rebuild.

## Step 8 — The test run (10 min)

On https://code-migrator.nnamdimichael020.workers.dev:

1. Hard refresh (**Ctrl + Shift + R**) → click **Go Pro ($7)** → Google
   sign-in → the Pro page.
2. You should see **"Upgrade to Pro"** and **"Continue to payment —
   $7/month"** (the "coming soon" text is gone).
3. Click it → a Lemon Squeezy checkout page opens (test-mode banner on top).
4. Card details:
   - Email: prefilled with your Gmail
   - Card number: `4242 4242 4242 4242`
   - Expiry: any future date (e.g. `12 / 34`), CVC: any 3 digits
5. **Pay**. You're redirected back to **/pro/success** — it says "activating
   Pro" and refreshes itself within a few seconds, then shows **"You're on
   Pro"** with your email.
6. Verify:
   - Header shows the green **Pro** badge and "Conversions: unlimited (Pro)"
   - Convert 4+ times — never blocked
   - A 300-line script converts (free tier refuses that)
   - `/api/auth/me` shows `"plan": "pro"`
7. Lemon Squeezy dashboard (Test mode): **Sales/Subscriptions** shows the
   test subscription; **Settings → Webhooks** shows deliveries with **200**.

## Step 9 — Test cancellation (know what to expect)

In Lemon Squeezy (Test mode) → **Subscriptions** → open the test subscription
→ **Cancel**. Note the behaviour — this is by design, and matches our Terms:

- Cancelling keeps the subscriber on Pro **until the end of the paid period**
  (`ends_at`). A $7 monthly cancel today keeps Pro for the rest of the month.
- When the period actually ends, Lemon Squeezy sends `subscription_expired`
  and the account drops to free automatically.
- You can watch the mapping work in the webhook delivery log; the
  cancel/expire → free logic is also covered by automated tests in the repo.

---

## Troubleshooting

| What you see | Meaning | Fix |
|---|---|---|
| /pro says "Pro checkout is almost ready" | One of the 4 secrets missing/misspelled, or PR not deployed | Exact names in Cloudflare; deployment green |
| "Could not start checkout" + Lemon Squeezy error | Values mixed from test and live modes | Re-copy ALL four while Test mode is ON |
| Success page stays on "activating Pro" | Webhook secret wrong or webhook URL typo | LS → Webhooks → check deliveries for errors; re-copy secret |
| "Sign in with Google first" | Login session expired mid-flow | Click Go Pro again |
| Go Pro → "not configured yet" | Google OAuth secrets never set (Step 0B) | Do the Google setup first |
| Card declined | Not in Test mode, or a real card | Flip Test mode ON; use 4242… |

## Going live with real money (later, not today)

1. Lemon Squeezy → turn **Test mode OFF**.
2. In live mode, repeat Steps 3–6: the live data is separate, so create a
   live API key, live product + variant ($7.00/month), and a live webhook
   (its own signing secret).
3. Swap the four Cloudflare secrets for the live values. Nothing else changes.
4. Before going live: request **store activation** in Lemon Squeezy (a quick
   review), and check the payout method available for your country in
   Settings → Payouts (Lemon Squeezy pays via PayPal or bank transfer
   depending on region). Do that check early so there are no surprises after
   your first paying customer.

Until then, everything runs in Test mode: the product flow — checkout, Pro
badge, unlimited conversions, cancel → free — is real and verified; only the
money is fake. That's the right state while you gather paying testers.
