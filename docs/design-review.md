# Website design and Tailwind review — 2026-09-27

## Result

Tailwind CSS 4 is suitable for this static, template-driven site. All 13 compiled pages now use the Tailwind build, with minified shared CSS and compiled component styles. There is no Tailwind browser runtime or CDN dependency. Existing selectors remain stable for JavaScript, while common layout/color declarations use Tailwind `@apply` and the brand tokens are exposed through the theme.

This is a Tailwind-backed CSS migration, not a claim that every bespoke style should become a utility class. Editorial grids, cinematic motion, media layouts, and exact typography retain custom CSS where it is clearer. Preflight is intentionally omitted to preserve the site's reset. Tailwind cannot itself optimize remote images, Instagram embeds, API latency, or missing content. Version 4 requires modern browsers: Safari 16.4+, Chrome 111+, Firefox 128+ (see https://tailwindcss.com/docs/upgrade-guide).

## Assessment and implemented fixes

- **Q2 cover artwork:** the four featured albums lacked usable verified mappings. Added canonical Bugs mappings for BILL STAX / LIVE FAST DIE SKRT, BewhY / POP IS CRYIN’, 반타01 & MPT / 아름8, and 박효신 / A & E. All four loaded with nonzero natural dimensions in Chrome. Local archive caching now invalidates when media, external-link, or NOW ARTIC data changes, so recent corrections do not remain hidden behind the five-minute cache.
- **Hierarchy:** NOW ARTIC cards now lead with the event title and show a two-line caption excerpt. Full captions remain available in the detail dialog. Cards and dialogs consistently prefer `eventTitle`.
- **Legibility:** improved shared muted-text contrast in both themes and enlarged the smallest archive labels. Shared token changes affect all pages, which were included in route checks.
- **Keyboard interaction:** NOW ARTIC uses native `<dialog>` modal handling. Opening moves focus inside, background interaction is blocked, Escape/close restores focus, and closing removes embedded media. No custom focus-trap dependency or animation timeout was added.
- **Reusable forms:** removed duplicate field IDs from the embedded waitlist component and supplied explicit accessible names. Repeated top/footer forms retain their independently scoped JavaScript.
- **Build/deployment:** Tailwind compiles shared and page styles through the existing source compiler. CI installs dependencies on Node 22 and validates compiled styles. Pages artifacts use a public-file allowlist, excluding installed dependencies and backend sources.

The existing editorial direction is worth retaining: oversized issue numbers, square covers, restrained rules, and generous whitespace. The renovation improves hierarchy and readability without replacing the site's identity. Mobile cards stack, project detail columns collapse, and the ACHA tier summary remains locally scrollable rather than widening the page.

## Verification

Commands passed:

```sh
npm run build
node scripts/validate_templates.js
node scripts/test_styles.js
node scripts/test_instagram_crawler.js
node scripts/test_instagram_pipeline.js
node --check server.js
node --check scripts/build_styles.js
git diff --check
```

Chrome was opened in a new window. Browser coverage included:

- Desktop and 390px mobile overflow/style checks for home, About, Projects, artic.le, Contact, Admin, Quarterly, ACHA detail, and all five project detail pages.
- Visual review of Quarterly hero/archive, four Q2 covers, ACHA hero/album rows, featured essay, project detail, and product modal; light and dark NOW ARTIC views.
- Mobile menu opening/closing, waitlist expansion, Q2 highlighted-track disclosure, essay navigation/expansion, NOW ARTIC focus entry/restoration, Escape, and media cleanup.
- Four Q2 image loads verified explicitly. No page-level horizontal overflow in the checked routes. Empty hidden product-image placeholders were excluded from broken-image findings.
- Product API initially returned 502: an existing Firestore process occupied port 8080 while Functions was absent. Started Functions with the existing local Firestore endpoint, then confirmed `/api/products` returned 200 and the product modal showed local inventory. No purchase or subscription was submitted.

Evidence is saved locally under `scratch/design-qa/`: `q2-covers.png` and `now-artic-dark.png`. The Chrome window remains open for review.

## Remaining limits

- Q2 contains 68 albums; only the four requested covers are currently verified in this issue. Other entries use intentional text fallbacks. Some highlighted tracks have no preview and correctly show “Preview unavailable.” Filling those gaps requires additional provider matching and source verification; CSS cannot recover them.
- QA used Chrome, not a Safari/Firefox or physical-device matrix. Mobile geometry and representative visual checks are not a substitute for those browser tests.
- The local host runs Node 25 while Functions requests Node 22; Firebase also reports an older `firebase-functions` dependency. Those environment/dependency upgrades were not bundled into this design migration. Firestore background triggers were not exercised with the separately started Functions emulator.
- No production deployment was performed. Automated CI itself has not run remotely. Third-party Instagram playback/login restrictions remain provider-controlled.
