# SwapThisFace.com search plan

Updated 28 September 2026. Implemented foundation; Stripe and real face processing are still deferred.

## Keyword selection and placement

Selection is based on the supplied list, product fit, and a live search-intent spot check. No paid-tool search volumes, keyword difficulty, country-specific ranking data, or Google Trends time series were available. Do not describe these as proven high-volume or rising keywords.

| Page | Main intent | Supporting phrases and placement |
| --- | --- | --- |
| `/` | photo face swap online | Main title, heading, introduction; AI photo face swap and realistic photo face swap in useful photo-preparation guidance |
| `/face-swap` | face swap photo editor | Title, H1, description; swap a face from one photo to another, two photos, phone-browser use, trial questions in visible FAQ |
| `/pricing` | face swap plans and credits | Weekly/monthly/yearly plan intent, credit expiry, one guest trial and subscription requirements |
| `/blog` | photo face swap guides | Editorial hub title, H1, description; specific informational intents belong in future articles |

Use “realistic” to explain quality and photo selection. Do not claim “most realistic,” guaranteed photorealism, 4K/HD enhancement, instant processing, or unlimited free access without evidence and matching functionality. “Real face swap” is ambiguous; clear photo-editor wording is more useful. The free/no-sign-up offer is one successful guest swap, not permanent free access. Mock previews are disclosed prominently.

## Deliberately not targeted now
- Video, GIF, real-time calls/streaming, group/multiple-face swaps: unsupported.
- Native Android/iPhone apps, APK/mod APK, offline tools: this is a browser application.
- Competitor names: no misleading affiliation or interchangeable keyword lists. Comparisons require firsthand testing, current sources, and a meaningful comparison later.
- ID/passport manipulation, specific personalities, sexualized use cases: not relevant acquisition pages for this product.
- Hundreds of near-identical landing pages: consolidate spelling/order variations into one useful page per intent.

## Technical work implemented
- Distinct page titles/descriptions, page-specific canonicals, Open Graph and Twitter metadata.
- WebSite schema on home; BlogPosting schema on published CMS articles, using actual title, summary, dates, and images. No invented ratings, reviews, authors, results, or prices.
- Existing CMS SEO title, description, canonical URL, and social-image fields feed the article output. Blank title/description fall back to article content; non-HTTP canonical/image schemes are rejected. JSON-LD escapes `<` to prevent closing the script element.
- Production sitemap traverses published posts in batches instead of stopping at the first 20. Drafts/future posts, private routes, and off-canonical article URLs are excluded. Blog pagination should be added as the article library grows beyond its current 20-card listing.
- Public indexing requires both `APP_ENV=production` and the root/www production hostname. Staging/dev have noindex metadata and an empty sitemap; robots permits crawling public pages so noindex can be read. Noindex is not access control.
- Dashboard and login stay noindex. Keep Google Search Console verification on the production domain.

## First CMS articles to write later

| Suggested slug | Article intent | Outline / evidence needed |
| --- | --- | --- |
| `how-to-swap-a-face-between-two-photos` | how to swap a face from one photo to another | Actual interface walkthrough, supported formats, permission reminder, trial and download details |
| `realistic-photo-face-swap-tips` | how to do a realistic face swap | Angle, lighting, sharpness, obstructions; verified before/after results after the provider goes live |
| `why-face-swap-results-look-unnatural` | realistic face swap troubleshooting | Failed examples, source/target adjustments, honest limits; no “perfect results” promise |
| `face-swap-photo-privacy` | is face swap safe | Current processor, retention, authorized use, deletion and support process |
| `face-swap-photos-on-iphone` | how to face swap a photo on iPhone | Browser instructions and HEIC-to-JPG export; no native-app claim |

Do not publish empty article shells. Each article should answer a distinct question, use original screenshots/examples with permission, and link naturally to the editor and a relevant supporting article. Populate the CMS SEO tab and descriptive cover alt text. Use an actual author and review date. Do not repeat the homepage's main title across articles.

## Launch and measurement
1. Connect and test the real processing provider and payments before marketing a working paid AI face swap. Replace staging-only copy and publish real, consented examples.
2. Finalize the legal launch checklist. Set production APP_URL to the chosen root or www URL; redirect the alternate hostname through the hosting/DNS configuration. Set APP_ENV=production only when the provider is ready and rebuild.
3. Verify rendered production canonicals, robots metadata, sitemap, HTTP status codes, Google/mobile rendering, and performance. Confirm login/dashboard remain noindex.
4. Verify a Search Console domain property using its supplied DNS record, then submit `/sitemap.xml`. These external steps are not completed by the local code changes.
5. Use Search Console impressions, clicks, CTR, and query/page data to refine titles and article priorities. Review country/device data and real conversion results; do not promise organic traffic or rankings.
6. Check Google Trends and Keyword Planner for a chosen market before treating search terms as trends. The supplied keyword list alone cannot establish demand.

## Sources consulted
- [Google title guidance](https://developers.google.com/search/docs/appearance/title-link): distinctive, descriptive titles and clear primary headings; avoid repeated keyword variants.
- [Google link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable): use descriptive links that help readers.
- [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing): crawlers must be able to fetch a page to observe noindex.
- [Google article markup](https://developers.google.com/search/docs/appearance/structured-data/article): provide article details that reflect the actual published page; markup does not guarantee a search feature.

## Homepage content expansion — 28 September 2026

The homepage now covers these distinct reader intents, without repeating exact-match variants in every section:
- Hero: put your face in another photo; source selfie plus target image.
- Photo selection: what source and target mean and which image supplies the composition.
- Creative ideas: portrait styles, costumes, vintage-inspired portraits, and photo cards. These are clearly ideas, not fabricated output examples.
- Realistic results: angle, lighting, clarity, and output review.
- Editing scope: two-photo face replacement versus prompt-based generation, filters, background edits, and clothing changes.
- Nine visible homepage FAQs: how-to, “any photo” limits, filters, realism, one free guest trial, browser/mobile use, clothing/backgrounds, unsupported multiple/video swaps, and permissions.

The homepage FAQ uses server-rendered HTML disclosures. No rich-result visibility or ranking gains are promised. Keep the mock-preview explanation until the actual provider is enabled, and revisit the trial metadata wording when it changes. Primary reference: [Google's people-first content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).
