# Private repository and Firebase Hosting

Audit date: 2026-10-09 (Asia/Seoul).

## Verified architecture

- Repository: `dev-artic/official_website`, personal account, public at audit time, default branch `main`.
- Existing frontend: GitHub Pages Actions workflow, HTTPS `artic.live`, DNS A records point to GitHub Pages.
- New frontend: classic Firebase Hosting, existing site `artic-official-home`, https://artic-official-home.web.app.
- Static compiler: `scripts/build_pages.js`; `_site/` contains only an explicit public allowlist. The local lyrics editor is excluded.
- Backend: 7 HTTP Cloud Functions plus 2 Firestore event triggers, all Node.js 22 in `us-central1`. Backend deployments remain separate from frontend CI.
- Authentication: existing admin bearer token (`ADMIN_TOKEN` in Secret Manager). The frontend stores it under its origin; logging in again will be required on the temporary `web.app` origin. The `artic.live` origin and login behavior survive DNS migration.
- Storage: existing Firestore orders, subscribers, products, Quarterly archive/media/audio caches; Notion data source and static media files. No database export, migration or production record writes are part of Hosting deployment.
- Firestore rules: default deny, plus existing users/projectJoinRequests/paytable portal rules. These are shared with other operations and must not be replaced by website-only rules.
- Existing automation: daily YouTube playlist synchronization at 18:10 KST with `MJ_YOUTUBE_API_KEY` in GitHub Secrets. NOW ARTIC collection and Quarterly publishing remain existing operational workflows.

## Costs and limits

GitHub Free supports private repositories and provides 2,000 Actions minutes/month and 500 MB artifact storage across the account. Linux runners, short timeouts, 3-day report retention and no large caches keep this pipeline small. These limits are shared with other repositories; no new paid plan or billing setting is enabled by these files.

Classic Firebase Hosting currently includes 10 GB storage and 10 GB transfer/month. The audited bundle is approximately 12.16 MiB. This project already has billing enabled for its backend (Blaze). Above Hosting free usage, storage is $0.026/GB and transfer $0.15/GB. Existing Functions/Firestore/SMTP costs continue. Budget alerts do not impose a hard spending cap. Do not downgrade the Firebase project to Spark: that would disrupt the existing Functions.

Sources: [GitHub Actions limits](https://docs.github.com/en/actions/reference/limits), [Pages plan restrictions](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Firebase Hosting pricing](https://firebase.google.com/docs/hosting/usage-quotas-pricing).

## Build, scan and deploy

```bash
PUPPETEER_SKIP_DOWNLOAD=true npm ci
npm ci --prefix functions
npm run build:hosting
node scripts/validate_templates.js
node scripts/test_styles.js
npm run test:hosting
npm audit --audit-level=high
npm audit --prefix functions --audit-level=high
firebase deploy --only hosting --project artic-official-home
npm run smoke:hosting
```

`checks.yml` runs on branch pushes, PRs, manual requests, weekly schedules, and as a prerequisite of main deployments. It scans full Git history and current files with Gitleaks, JavaScript with Semgrep, and both lockfiles with npm audit. All actions are commit-pinned. Semgrep combines checked-in rules with the official `p/javascript` ruleset, ERROR findings block CI, and telemetry is disabled. Registry rule updates may change findings; rules download/parse errors fail the job. Reports remain in short-lived Actions artifacts instead of paid private-repository SARIF dashboards. Dependabot creates weekly dependency/action update PRs.

Two exact historical Gitleaks fingerprints are documented public Firebase browser configuration, not the admin token. API-key restrictions could not be read with the current credential (403); review restrictions in Google Cloud separately. No broad Google-key allowlist is used. New keys still fail the check.

At implementation, root audit has zero findings. Functions audit has no high/critical findings; remaining moderate Firebase SDK transitive advisories require a separately tested SDK upgrade. Source changes upgrade Nodemailer and compatible transitive dependencies; they affect running Functions only on a later explicit backend deployment. This Hosting workflow never deploys Functions or Firestore rules.

Security headers preserve inline scripts required by the current static compiler. CSP allows inline scripts and HTTPS providers; it is a compatibility boundary, not complete XSS prevention. Admin token storage, permissive backend CORS and the external image proxy remain existing backend security surfaces. Static scanning is not a penetration test. Production smoke tests use page reads, public products reads and unauthenticated admin rejection only.

## OIDC permissions: approval required

After approval, run `bash scripts/setup_hosting_ci.sh --apply` using a Google Cloud CLI login with IAM configuration access. It creates:

- Service account `github-hosting-deploy@artic-official-home.iam.gserviceaccount.com`.
- `roles/firebasehosting.admin` and `roles/serviceusage.serviceUsageConsumer` on this project. Hosting admin can manage Hosting sites; it has no Firestore, Functions, Auth, Secret Manager or SMTP permission.
- Workload Identity pool `artic-github`, provider `hosting`, and `roles/iam.workloadIdentityUser` on this service account.
- Provider condition bound to repository ID `953382197`, owner ID `201251886`, `refs/heads/main`, `deploy-hosting.yml`, and push/manual events. PRs and fork identities are denied.
- GitHub variables `FIREBASE_WORKLOAD_IDENTITY_PROVIDER`, `FIREBASE_DEPLOY_SERVICE_ACCOUNT`. No service account key is generated.

Enable `FIREBASE_DEPLOY_ENABLED=true` after configuration and merge. Main pushes then scan, build, authenticate with OIDC, deploy only Hosting and run live smoke checks. Verify a successful actual Actions deploy before domain cutover. Use `gh workflow run deploy-hosting.yml --ref main` to retry. Playlist bot pushes explicitly dispatch the selected deployment workflow because a `GITHUB_TOKEN` push does not trigger a second push workflow.

## Domain and privacy cutover: approval required

1. Add `artic.live` to the existing Firebase Hosting site using the advanced migration flow. Obtain Firebase's actual verification/TXT and serving records; do not guess them.
2. Add only the requested verification/DNS records after approval. Preserve all MX, mail-related TXT, nameservers and registrar ownership. `CNAME` in this Git repository does not update DNS.
3. Keep GitHub Pages serving until Firebase reports ownership verified and the migration certificate is ready. Change the apex A/AAAA records to Firebase's supplied records after approval. Keep the previous GitHub A records for rollback.
4. Verify HTTPS `https://artic.live`, admin login UI, Quarterly pages, provider images/embeds, public API reads and unauthenticated admin rejection. An authenticated admin read requires the existing operator session; no test orders/subscriptions/emails are needed.
5. Once `artic.live` demonstrably serves Firebase, retire `deploy-pages.yml`, set the playlist deployment target to Firebase, then change repository visibility to private with approval. On GitHub Free, making it private earlier can unpublish the Pages site.
6. Verify unauthenticated GitHub repository lookup is denied and rerun checks/deploy against the private repository. Existing GitHub secret remains.

The transition workflow uses `FIREBASE_DEPLOY_ENABLED` to select the explicit playlist deployment target and logs that target. Until cutover, Pages remains the selected production target. There is no silent retry to another host on error.

## Rollback

Firebase Console Hosting release history can roll back static releases. For a domain rollback, restore the recorded GitHub A records only while the Pages deployment and public repository still exist. After privacy cutover, prefer Firebase release rollback; Pages would require re-exposing source or a paid GitHub plan. Production operational data is unaffected by static release rollback.
