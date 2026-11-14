# NEXA BidOps · Netlify deployment

This is the Netlify-native deployment package for the dashboard. Netlify serves the static UI and runs its serverless API functions; the PHP application one level above is a separate PHP/MySQL hosting option.

The self-serve flow stores account and trial records in Supabase. Customer owners can start a seven-day trial, choose Pro ($10/month), Premium ($50/month) or Enterprise ($100/month), and use hosted Stripe card checkout or M-Pesa checkout after provider configuration. Do not publish production checkout until live credentials, prices and webhook/callbacks have been tested.

## Opportunity discovery and source directory

The Opportunity Radar includes a curated starting directory for official buyer portals, Google/Bing, development-sector aggregators and adjacent context sources. Choose a capability cluster (digital learning, LMS, cloud/cybersecurity, programme delivery or all) and a market. The generated links open an external Google search scoped to the source domain and combine relevant terms with procurement language; common poor-fit searches are excluded. Those manual search links do not import results into the pipeline.

Sources are deliberately categorized:

- **Official portals** are the preferred place to validate a notice and its deadline.
- **Google/Bing** are free search engines, not tender feeds.
- **DevelopmentAid, Devex and dgMarket** have varying free/paid access; check current limits and pricing before subscribing.
- **UNjobs** is primarily an individual jobs index; use its website and other aggregators as manual research, not a company tender feed.

The scheduled discovery function uses the anonymous [TED public notices API](https://docs.ted.europa.eu/api/latest/search.html) and the [UK Find a Tender OCDS feed](https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages). Both are free to query and require no search-provider API key. For each organization with a completed profile, TED queries use that organization's capabilities, preferred keywords and sectors; retrieved notices are then scored against its profile and saved only to that organization. The UK feed is fetched once per scheduled run and screened separately for each organization. It does not use Anthropic or scrape Google.

The company profile is required on the first owner or manager sign-in. It includes capabilities, search keywords, target sectors and markets, buyer types and company evidence. Staff must ask their workspace administrator to complete an incomplete profile. Match percentages are weighted text-alignment signals (capabilities 45%, keywords 20%, sectors 15%, target markets 10%, buyer types 10%); they are not eligibility checks, compliance decisions, or win probabilities. An external result is not proof of eligibility, availability or an active tender. Verify the original notice, legal-entity rules, registrations, mandatory criteria and deadline.

## Product tiers and billing

- **Pro:** daily discovery, fit explanations and one newly generated proposal draft per UTC day. Saved proposals can still be edited.
- **Premium:** everything in Pro plus the shared project portfolio, delivery timeline and milestone Gantt.
- **Enterprise:** everything in Premium plus Anthropic-assisted proposal generation and an AI learning library. Learning drafts are never approved automatically; an owner/manager must review them.
- Google/Microsoft mailbox OAuth is **not enabled in this deployment**. Until email provider authorization is implemented and configured, communication must be logged manually; do not describe the mailbox agent as live.
- Stripe Checkout is a monthly recurring subscription. M-Pesa uses a one-off STK push; it does not automatically charge next month. The app reminds customers before the paid period ends and pauses access if it expires.
- A new account starts a seven-day trial without payment. Dashboard and transactional email reminders start with three days remaining. At trial/paid-period expiry, access to workspace records pauses; the customer can still sign in to pay. Verified payment events reactivate access.

## Platform owner and customer records

The restricted [NEXA platform administration page](site/platform-admin.html) shows all customer workspaces, registration dates, account status, last sign-in, trial/payment state, returning-customer flags, support enquiries and marketing opt-ins. The master owner can change workspace/contact/billing fields and deactivate/reactivate accounts. Deactivation preserves customer records and audit history; it is reversible.

Marketing consent is optional and stored separately from account registration. The master console exports only contacts who opted in. A support enquiry is not marketing consent. Customer records stay in your Supabase project; use a privacy notice and retention period appropriate to your customers before launch.

To establish your master account, first create a normal BidOps account, then sign in at `site/platform-admin.html`. Add a random `NEXA_PLATFORM_SETUP_KEY` of at least 32 characters to Netlify and use it once in the first-time setup panel. The first owner account becomes the NEXA platform administrator and receives an internal Enterprise subscription. Remove `NEXA_PLATFORM_SETUP_KEY` from Netlify after setup. Never share this key.

## Workspace preview

Open the workspace preview to see records across discovery, go/no-go, drafting, review, submitted, won, lost and no-go; proposal-review states; activity; and award-to-launch plans with milestones. The records are not live company or buyer data, procurement notices, forecasts or claims of past performance.

## What you can preview now

The deployment automatically opens in **preview mode** when the live backend is not configured. Preview does not create accounts, contact buyers, or save to a production database. Edits live only in that browser session.

For local static preview, open `site/index.html?preview=1` in a browser. An Internet-connected browser is required for Netlify-hosted function routes; local preview mode does not need them.

## Deploy an instant preview

### Netlify UI

1. Extract the deployment ZIP on your computer first.
2. In Netlify, create or open a site and choose **Deploy manually**.
3. Drag the contents *inside* the extracted `site` folder (`index.html`, `_headers`, and `assets`) into the manual deploy dropzone. Do not upload the source ZIP itself or the parent folder.
4. Open the generated `*.netlify.app` URL with `?preview=1` appended (for example `https://your-site.netlify.app/?preview=1`). The sample workspace opens directly; it does not create accounts or save production data.

This static/manual deploy is a product preview; it intentionally has no live account or persistent backend. The serverless API is enabled by a Git-connected or CLI build, not a manual static deploy.

### Git-connected site with serverless functions

1. Push or connect the repository containing this package to Netlify.
2. In **Site configuration → Build & deploy → Build settings**, make the **base directory the folder that contains this `netlify.toml`**. For this project's original repository layout that is `afrocloud-bid-centre/netlify-deploy`. If you extracted this ZIP directly into the repository root, clear the base-directory setting (leave it blank). Do not set the base to `site`; Netlify needs the package root to find `netlify.toml` and `netlify/functions`.
3. Confirm the deploy settings resolve to **publish directory `site`** and **functions directory `netlify/functions`**, relative to the selected base directory. In that same directory, `site/index.html` must exist.
4. Trigger a deploy. Until the live backend is configured, open the deployed URL with `?preview=1` to use the browser-only preview.

Netlify CLI alternative: in this `netlify-deploy` directory, run `npx netlify-cli deploy --build`. Run `npx netlify-cli deploy --build --prod` only when you intend to publish the production site.

## Supabase, self-serve sign-up and payments

1. Create a Supabase project in an organization/account approved for your customers' data.
2. In the Supabase SQL editor for that project, run [`supabase/setup.sql`](supabase/setup.sql).
3. Configure Supabase **Authentication → URL Configuration** with the deployed HTTPS Netlify site URL and root as an allowed redirect URL. Set the desired email-confirmation and password policies, and configure production SMTP for account verification and team invitations.
4. In Netlify, set the following environment variables. Secrets belong only in the protected Functions runtime environment, never in `site`, browser code or a public ZIP:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Project URL from Supabase API settings |
   | `SUPABASE_ANON_KEY` | Project publishable/anon key; used only for Auth requests |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project service-role key; server-side functions only — never put it in `site`, browser JavaScript, or a public build setting |
   | `NEXA_APP_KEY` | A unique random secret of at least 32 characters for HMAC-based login rate limiting |
   | `NEXA_PLATFORM_SETUP_KEY` | One-time master-owner setup secret (remove after first platform-admin setup) |
   | `STRIPE_SECRET_KEY` | Stripe secret API key for hosted recurring card checkout |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
   | `MPESA_ENVIRONMENT` | `sandbox` while testing; `production` after Daraja approval |
   | `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET` | Daraja API credentials |
   | `MPESA_SHORTCODE`, `MPESA_PASSKEY` | Approved paybill/till details and STK passkey |
   | `MPESA_CALLBACK_TOKEN` | Unique random callback guard secret of at least 32 characters |
   | `NEXA_PRICE_KES_PRO`, `NEXA_PRICE_KES_PREMIUM`, `NEXA_PRICE_KES_ENTERPRISE` | Approved whole-KES plan prices |
   | `RESEND_API_KEY`, `NEXA_EMAIL_FROM` | Resend API secret and a verified sender address |
   | `NEXA_SUPPORT_EMAIL` | Support inbox; defaults to `nexainnovates@gmail.com` |
   | `NEXA_SITE_URL` | Deployed HTTPS site URL used in reminder emails |

5. Add `ANTHROPIC_API_KEY` as a Netlify secret to enable Enterprise AI proposal and learning drafts. Usage may be billable. AI output is a draft and requires a human evidence review.
6. Configure Stripe to send signed `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted` events to `https://YOUR-SITE/api/index.php?route=stripe-webhook`. Verify a test-mode transaction and webhook signature before enabling live checkout.
7. Configure M-Pesa Daraja callbacks to the same site's `/api/index.php?route=mpesa-callback`; the app verifies callback amount and receipt and performs a server-to-server STK query before activation. Test in sandbox. M-Pesa renewals are customer-initiated, not recurring autopay.
8. Configure Resend with a verified sender; otherwise support requests remain stored but cannot be emailed, and reminder messages are not delivered. Reminders use the scheduled `billing-maintenance` function, which also pauses expired subscriptions.
9. Redeploy after setting variables. Customers create accounts themselves, confirm email if configured, select a plan, then complete company evidence onboarding. Their first seven trial days begin at registration.
10. Owners can invite staff and project managers from **Team access**. Use **Portfolio report → Download workspace backup** to save a JSON backup; keep it secure.
11. The `discover-tenders` scheduled function runs daily at 00:00 UTC (03:00 East Africa Time), querying TED and UK Find a Tender. It screens each completed company profile separately. It is not a whole-web crawler, and Google Search is a manual link, not an API feed.

Generate a rate-limit key with a trusted local password manager or a cryptographically secure local generator. Keep it and the Supabase service-role key only in Netlify's protected environment-variable store. Rotate either key if it is exposed.

## Access controls and data boundaries

- Serverless routes validate Supabase Auth access tokens and check each user against `bid_users`, workspace activity and subscription state. Expired workspaces cannot read their workspace records; billing routes remain available to the owner to restore access.
- Only authenticated owners/managers can list and invite team members. Only the owner can assign manager access; managers can invite staff only. Owner records and an administrator's own access cannot be changed through the staff UI.
- Customer self-registration uses Supabase Auth; staff invitations use Supabase Admin Auth on the server. Passwords are never stored by BidOps. Workspace deactivation by the NEXA platform administrator is reversible and retains the data and audit history.
- Cross-customer account lists and controls require an explicit `nexa_platform_admins` record. The first master owner is established only with the one-time setup key. Platform changes are recorded in the platform-admin audit log.
- Signup, support enquiries, trial status, subscription changes, payment attempts, return-customer state and consent timestamps are stored in Supabase. Marketing opt-in is optional; the platform console exports only opted-in contacts. Support requests do not imply marketing consent.
- Database reads and writes use the service key only inside Netlify Functions. The included SQL enables RLS, revokes direct `anon`/`authenticated` access, and grants app-table access only to `service_role`. API queries, exports, invitations, audit events and scheduled discovery filter by `organization_id`; customer data is not isolated by UI filtering alone.
- Login attempts are limited using an atomic, HMAC-keyed 15-minute counter in Postgres. API writes validate fields and role permissions; significant actions are audited. Daily discovery runs and their outcomes are saved in Postgres.
- Stripe webhook signatures are checked before activating card subscriptions. M-Pesa callbacks are matched to a pending checkout, amount and receipt, then verified with Daraja's STK query API before activation. Never use live billing until sandbox tests pass and Netlify variables are set.
- `billing-maintenance` sends transactional renewal/trial messages and pauses expired access. Marketing campaigns are not sent by BidOps; use only the CSV contacts with explicit opt-in and honor unsubscribe requests.
- Live session/refresh tokens stay in the current browser tab's `sessionStorage`. HTTPS is provided by Netlify; the deploy sets HSTS, CSP, frame, and MIME protections.
- Enterprise AI proposal and learning drafts send the relevant company/opportunity context and any retrospective notes to Anthropic only when its API key is configured. Public-source tender screening does not send workspace data to an AI service. Do not send sensitive information unless its use is authorized and consistent with your organization's policies. Learning drafts require human approval.
- There is no live Gmail/Outlook/MCP connector in this build. Timeline communication entries are manually recorded and do not read inboxes, send buyer emails or verify replies.
- Set Supabase Auth password, invite, recovery, region, backup and retention policies to your organisation's requirements. Give the service role key only to the API Functions environment.
- The scheduled scan is a limited integration with TED and the UK Find a Tender OCDS feed, not a whole-web crawler or a direct integration with Google, UNGM, TendersKenya, UNjobs or every buyer portal. Verify the official notice, supplier eligibility, deadline, claims and pricing before submission. No proposal can guarantee an award.

## Troubleshooting

- **AI drafting is not configured?** Add `ANTHROPIC_API_KEY` as a Netlify secret, then redeploy.
- **Cards do not open?** Configure `STRIPE_SECRET_KEY` and the signed webhook endpoint/secret; check Stripe test-mode logs.
- **M-Pesa does not open?** Configure Daraja credentials, approved shortcode/passkey, KES prices and callback token; test using `MPESA_ENVIRONMENT=sandbox`.
- **Trial emails are missing?** Configure a verified `NEXA_EMAIL_FROM`, `RESEND_API_KEY`, and `NEXA_SITE_URL`; check the `billing-maintenance` scheduled-function logs.
- **Cannot access the platform console?** Sign in with an active workspace owner account, then use the one-time `NEXA_PLATFORM_SETUP_KEY` only if no platform admin has been created. Remove the key from Netlify after first setup.
- **No daily discovery results?** Confirm the updated SQL ran successfully, the `SUPABASE_URL` and service-role key point to the same project, and the `discover-tenders` Function logs show a completed run. The scan does not require `ANTHROPIC_API_KEY`; it runs at 00:00 UTC and may find no matching current notices. A partial source outage is shown in the discovery-run record.
- **`Deploy directory 'site' does not exist`?** Netlify is building from the wrong base directory or the ZIP/parent directory was uploaded as a manual deploy. For Git/CLI builds, set the base to the folder containing `netlify.toml` and confirm `site/index.html` exists beneath it. For a manual deploy, extract the ZIP and deploy the contents of its `site` folder; do not use the project-source ZIP as the publish folder.
- **`Could not be authorised` / missing BidOps access?** Confirm the auth email belongs to an active `bid_users` row and the role is `owner`, `manager` or `writer`.
- **Database service unavailable?** Confirm the SQL setup completed, the Supabase URL/key pair belong to the same project, and the Netlify Functions environment contains the service-role key.
- **Preview does not work from a `file://` URL?** Deploy the `site` folder to Netlify; use its HTTPS preview URL. Alternatively try `?preview=1` while serving `site` locally over HTTP.

This is a deployable package, not a site deployed to or controlled by the developer. Production hosting, Supabase resources and account grants remain under the user's ownership.
