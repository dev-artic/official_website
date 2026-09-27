# Quarterly NOW ARTIC ripper

Use this workflow to collect or refresh artic.live Instagram event coverage for Quarterly.

## Collect and review

Run `node scripts/crawl_instagram_now_artic.js --dry-run -v` first. For selected posts, set `NOW_ARTIC_REEL_URLS` to comma-separated public reel/post URLs. `NOW_ARTIC_MAX_REELS`, `NOW_ARTIC_SCROLL_PASSES`, and `NOW_ARTIC_HEADLESS=false` control the crawl. Dry-run must not write images, snapshots, or invoke build/deployment.

The collector scans the reels and main profile pages, classifies live-event captions, and excludes press releases, tasting notes, and source-attribution posts. Explicitly excluded posts must not be restored from existing data. Preserve existing posts not encountered or whose detail request failed. A fatal crawl failure must leave existing snapshots intact.

## Event titles

`eventTitle` names the event, not the opening caption sentence or what the performer did in the video. Read the full caption, preserving artist, official event name, and relevant event type. Examples:

- `2026 SUMIN LIVE dinnermode`
- `신인류 단독공연 [지켜야 할 것들이 많아서 날개가 커지는 밤]`
- `진환민 개인전 《Transcribed Breath》 오프닝 퍼포먼스`
- Existing curated title: `강지원 'Ordinary Ever After' Listening Session`

Keep curated `eventTitle` and `venue` overrides. The automatic parser recognizes explicit concert/live/exhibition names; an empty result requires editorial review. Do not invent an album or event name absent from the source. The Kangziwon album name is not present in the saved caption, so retain its curated override rather than claiming it was automatically extracted. Keep `artic.` intact in source captions.

Dates represent the source calendar date, independent of the machine timezone. Do not adjust historical dates without checking the original post. `scanned` counts attempted detail pages.

## Save and verify

Run `node scripts/crawl_instagram_now_artic.js` to download previews and update `functions/data/quarterly_now_artic.json`, the scratch snapshot, and the existing archive snapshot. Review the diff, including new images and unresolved titles. The script builds and validates templates.

Run:

```sh
node scripts/test_instagram_crawler.js
node scripts/test_instagram_pipeline.js
TZ=Asia/Seoul node scripts/test_instagram_crawler.js
TZ=America/Los_Angeles node scripts/test_instagram_crawler.js
npm run build
node scripts/validate_templates.js
```

For visible QA, start `npm run dev`, open `http://localhost:8000/quarterly/?artic_uat=local`, and hard-refresh. Check the event title, date, venue, preview and embed for every changed note; check mobile layout and modal dismissal. The local-mode query resets any saved production API override.

## Publish only when requested

Collection does not authorize deployment. Before a requested production deployment, follow the full README review gate in AGENTS.md and commit code/documentation changes together. Review the Git index and use the intended main branch before invoking `--deploy`; it commits data/images, pushes main, deploys `quarterlyContents`, then clears its archive cache. Scratch files remain ignored. Every command must succeed before the next stage, and success must only be reported after cache invalidation succeeds.

### Caption display

Keep the source caption intact. In archive cards and the NOW ARTIC detail dialog, omit trailing venue/credit information and a trailing standalone event name matching `eventTitle`; show those values in the heading and metadata table. Preserve event-name mentions inside narrative sentences. Instagram metadata may flatten original line breaks, so this rule must also work with whitespace-normalized captions. Verify with `node scripts/test_now_artic_caption.js`.
