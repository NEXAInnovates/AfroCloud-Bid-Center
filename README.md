# Netlify build — AfroCloud BidOps Studio

This is the Netlify-native deployment package for the dashboard. Netlify serves the static UI and runs its serverless API functions; the PHP application one level above is a separate PHP/MySQL hosting option.

## Opportunity discovery and source directory

The Opportunity Radar includes a curated starting directory for official buyer portals, Google/Bing, development-sector aggregators and adjacent context sources. Choose a capability cluster (digital learning, LMS, cloud/cybersecurity, programme delivery or all) and a market. The generated links open an external Google search scoped to the source domain and combine relevant terms with procurement language; common poor-fit searches are excluded. Search links do not import results into the pipeline.

Sources are deliberately categorized:

- **Official portals** are the preferred place to validate a notice and its deadline.
- **Google/Bing** are free search engines, not tender feeds.
- **DevelopmentAid, Devex and dgMarket** have varying free/paid access; check current limits and pricing before subscribing.
- **UNjobs and ReliefWeb** are adjacent job/context sources, not company RFP databases.

The capability terms are derived from the attached prototype, not independently verified AfroCloud qualifications. Broaden or narrow the search based on documented capacity. An external search result is not proof of eligibility, fit, availability or an active tender. Verify the buyer's original notice, legal-entity rules, registrations, mandatory criteria and submission deadline before capturing a real opportunity.

The brand treatment currently uses an AfroCloud text wordmark. Public searches did not locate a logo that could be verified as belonging to this specific company; replace it with an approved logo file when AfroCloud supplies one.

## Workspace preview

Open the workspace preview to see ten records across discovery, go/no-go, drafting, review, submitted, won, lost and no-go; proposal-review states; activity; and two award-to-launch plans with dated milestones. The records are not live company or buyer data, procurement notices, forecasts or claims of past performance. The preview banner remains visible.

## What you can preview now

The deployment automatically opens in **preview mode** when the live backend is not configured. A persistent banner indicates that the records are not live company or buyer data. Preview does not create accounts, contact buyers, or save to a production database. Edits live only in that browser session.

For local static preview, open `site/index.html?preview=1` in a browser. An Internet-connected browser is required for Netlify-hosted function routes; local preview mode does not need them.

## Deploy an instant preview

### Netlify UI

1. Extract the deployment ZIP on your computer first.
2. In Netlify, create or open a site and choose **Deploy manually**.
3. Drag the contents *inside* the extracted `site` folder (`index.html`, `_headers`, and `assets`) into the manual deploy dropzone. Do not upload the source ZIP itself or the parent folder.
4. Open the generated `*.netlify.app` URL with `?preview=1` appended (for example `https://your-site.netlify.app/?preview=1`). Click **Preview workspace** on the sign-in page.

This static/manual deploy is a product preview; it intentionally has no live account or persistent backend. The serverless API is enabled by a Git-connected or CLI build, not a manual static deploy.

### Git-connected site with serverless functions

1. Push or connect the repository containing this package to Netlify.
2. In **Site configuration → Build & deploy → Build settings**, make the **base directory the folder that contains this `netlify.toml`**. For this project's original repository layout that is `afrocloud-bid-centre/netlify-deploy`. If you extracted this ZIP directly into the repository root, clear the base-directory setting (leave it blank). Do not set the base to `site`; Netlify needs the package root to find `netlify.toml` and `netlify/functions`.
3. Confirm the deploy settings resolve to **publish directory `site`** and **functions directory `netlify/functions`**, relative to the selected base directory. In that same directory, `site/index.html` must exist.
4. Trigger a deploy. Until the live backend is configured, open the deployed URL with `?preview=1` to use the browser-only preview.

Netlify CLI alternative: in this `netlify-deploy` directory, run `npx netlify-cli deploy --build`. Run `npx netlify-cli deploy --build --prod` only when you intend to publish the production site.

## CEO / Project Manager admin login and staff accounts

The app has a private sign-in for the CEO/workspace owner, project managers and staff. There is **no public sign-up form**. Owners and managers use the Team access page to invite staff; the invite email lets each person set their own password. Passwords are never chosen or stored by the inviter.

1. Create a Supabase project in an organization/account approved for AfroCloud data.
2. In the Supabase SQL editor for that project, run [`supabase/setup.sql`](supabase/setup.sql).
3. Configure Supabase **Authentication → URL Configuration** with the deployed HTTPS Netlify site URL and its root as an allowed redirect URL. Configure a production SMTP sender for invitation emails; do not rely on Supabase's development email limits for staff onboarding.
4. In **Authentication → Users**, invite the CEO/workspace owner using their work email. Copy that Auth user's UUID. In the SQL editor, grant the first owner using the actual UUID, email and verified display name:

   ```sql
   insert into public.bid_users (user_id, email, display_name, role)
   values ('REPLACE-WITH-AUTH-USER-UUID', 'ceo@your-company.example', 'AfroCloud owner', 'owner');
   ```

   Replace both example values. The owner signs into BidOps with the invited email and the password they set from the invitation link.
5. In Netlify site environment variables, add:

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | Project URL from Supabase API settings |
   | `SUPABASE_ANON_KEY` | Project publishable/anon key; used only for Auth requests |
   | `SUPABASE_SERVICE_ROLE_KEY` | Project service-role key; server-side functions only — never put it in `site`, browser JavaScript, or a public build setting |
   | `AFROCLOUD_APP_KEY` | A unique random secret of at least 32 characters for HMAC-based login rate limiting |

6. Redeploy after setting variables, then sign in as the owner. Open **Team access → Invite a team member** to add staff (`Staff`) or project managers (`Project manager`). Only the owner can grant project-manager access; managers can invite staff and manage staff accounts. Existing owner accounts are protected from changes in the UI.
7. Confirm a staff invitation arrives and can be accepted before onboarding the full team. The invited person uses the email link to set their own password and then signs in on the same Netlify site.

Generate a rate-limit key with a trusted local password manager or a cryptographically secure local generator. Keep it and the Supabase service-role key only in Netlify's protected environment-variable store. Rotate either key if it is exposed.

## Access controls and data boundaries

- Serverless routes validate Supabase Auth access tokens and check each user against `bid_users`. Inactive or unlisted Auth accounts are denied.
- Only authenticated owners/managers can list and invite team members. Only the owner can assign manager access; managers can invite staff only. Owner records and an administrator's own access cannot be changed through the staff UI.
- Invitation requests use Supabase Admin Auth on the server with the service-role key; password setup stays with the invitee. Public account creation remains disabled. Deactivation blocks BidOps access without deleting the user's Auth record or audit history.
- Database reads and writes use the service key only inside Netlify Functions. The included SQL enables RLS, revokes direct `anon`/`authenticated` access, and grants app-table access only to `service_role`.
- Login attempts are limited using an atomic, HMAC-keyed 15-minute counter in Postgres. API writes validate fields and role permissions; significant actions are audited.
- Live session/refresh tokens stay in the current browser tab's `sessionStorage`. HTTPS is provided by Netlify; the deploy sets HSTS, CSP, frame, and MIME protections.
- Set Supabase Auth password, invite, recovery, region, backup and retention policies to your organisation's requirements. Give the service role key only to the API Functions environment.
- No tender scraper, file upload, external language model, email sender, live buyer integrations or financial forecast is connected. Preview records are not company evidence. Verify tender notices, eligibility, claims and pricing before submission.

## Troubleshooting

- **Still see the preview banner?** Netlify is not seeing all four live environment variables, the key is too short, or the site has not been redeployed after changing variables.
- **`Deploy directory 'site' does not exist`?** Netlify is building from the wrong base directory or the ZIP/parent directory was uploaded as a manual deploy. For Git/CLI builds, set the base to the folder containing `netlify.toml` and confirm `site/index.html` exists beneath it. For a manual deploy, extract the ZIP and deploy the contents of its `site` folder; do not use the project-source ZIP as the publish folder.
- **`Could not be authorised` / missing BidOps access?** Confirm the auth email belongs to an active `bid_users` row and the role is `owner`, `manager` or `writer`.
- **Database service unavailable?** Confirm the SQL setup completed, the Supabase URL/key pair belong to the same project, and the Netlify Functions environment contains the service-role key.
- **Preview does not work from a `file://` URL?** Deploy the `site` folder to Netlify; use its HTTPS preview URL. Alternatively try `?preview=1` while serving `site` locally over HTTP.

This is a deployable package, not a site deployed to or controlled by the developer. Production hosting, Supabase resources and account grants remain under the user's ownership.
