# SwapThisFace.com production launch — 8 October 2026

Target: real single-face photo swaps at **https://swapthisface.com**, Google login, private R2 storage, and no purchases. Paddle integration follows later. Ibtihaj Uddin, trading as SwapThisFace.com operates from Pakistan; its business contact address is still needed.

## Before the domain cutover

1. Use `CUSTOM_SWAP_RESULT_HOSTS=img.theapi.app`, observed in the successful live API test on 8 October 2026. Use exact hostnames, including legitimate redirect destinations, not the API submission host unless it actually serves the output. See [Custom Swap setup](CUSTOM-SWAP-SETUP.md).
2. Test a real guest swap on staging using photos you have permission to process. Confirm the output saves to R2, downloads through the app, and settles the free trial once. Confirm failed jobs release the trial. The direct provider call and secure download have passed with synthetic portraits; the complete deployed app/R2 flow still needs this check.
3. Back up the current database. Decide whether to promote the existing data or create separate production database/buckets. Do not silently delete test users, jobs, or files. Keep staging isolated if it will continue to run.
4. Commit and push the prepared code to the branch connected to Railway. Include `src`, `tests`, `docs`, `migrations`, and `.env.example`. Never commit `.env.local` or credentials.

## Railway variables

Set these on **web and worker**:

```dotenv
APP_ENV=production
APP_URL=https://swapthisface.com
SWAPS_ENABLED=true
SWAP_PROVIDER=external
CUSTOM_SWAP_URL=https://faceswap-django.onrender.com/faceswap_file/
CUSTOM_SWAP_RESULT_HOSTS=img.theapi.app
STORAGE_DRIVER=r2
```

If present, align `NEXT_PUBLIC_APP_URL` to `https://swapthisface.com` and remove or align the old `FACE_SWAP_PROVIDER=mock` alias. Keep database, R2, Google, auth and CMS settings configured for the selected production resources. Stripe keys/prices are no longer needed: checkout/credits/portal endpoints return 503 and Stripe webhooks return 410 even if old keys remain. The worker does not process Stripe inbox events.

Set the web pre-deploy command to `npm run release`; this includes migration `0008_swap_provider_consent.sql`. Deploy web migrations before the new worker. Web starts with `npm run start`, worker with `npm run worker`. Rebuild after environment changes so canonical URLs and indexing reflect the production domain. The Dockerfile declares the public configuration build arguments needed for Railway to supply these values during `next build`; secrets remain runtime variables.

`SWAPS_ENABLED=false` is an optional maintenance switch that closes new uploads and jobs, pauses queued processing and permits a nonprocessing mock configuration. The requested launch uses `true`; production with active mock processing is rejected.

## Domain and sign-in

1. Railway → web service → Settings → Networking → Custom Domain: add `swapthisface.com`.
2. Copy the exact CNAME and domain-verification TXT records Railway displays into your DNS provider. Do not guess the target. For Cloudflare's root domain use its CNAME flattening. Wait for Railway domain verification and HTTPS issuance.
3. Configure `www.swapthisface.com` to redirect to `https://swapthisface.com`, preserving paths and query strings. If www serves Railway directly, attach it there too before configuring the redirect.
4. In the Google OAuth web client, add authorized origin `https://swapthisface.com` and redirect URI `https://swapthisface.com/api/auth/callback/google`. Retain the staging callback only if staging remains in use. Check OAuth consent-screen authorized domain and publishing status.
5. Remove the staging hostname from the promoted service after cutover, or point it to a separate staging service with `APP_ENV=staging`. Merely changing APP_URL does not isolate an old hostname.

## Verify on the public domain

- `/api/health/ready` returns 200, Google sign-in returns to the production domain, CMS owner login works.
- One real guest swap works; output is private and has no mock watermark. Invalid uploads and failed provider jobs are handled without consuming the trial.
- Pricing says coming soon; purchases and billing portal cannot open. Stripe webhook returns 410.
- Homepage, studio, blog, privacy, terms, and refunds pages load on mobile; canonicals use the root domain; `/robots.txt` and `/sitemap.xml` reflect production. Login/dashboard remain noindex.
- Worker cleanup continues and expired photos become unavailable.

The existing entitlement model still permits only one guest trial. Account-based additional swaps require an eligible subscription and credits; new purchases remain unavailable until Paddle is integrated. Do not advertise unlimited free use.

## Paddle review still needs

A live HTTPS site is one requirement, not an approval guarantee. Paddle also requests a clear product description, pricing details (a screenshot can be supplied if not published yet), included features, company name, and accessible terms, privacy and refund policies. The current refund page explains that no purchases are accepted; paid refund eligibility and pricing are still undecided. Finalize those before submitting a paid offering for review. Supply the business contact address and confirm the photo processor's retention/training terms; do not invent these details.

References:
- [Paddle domain review](https://www.paddle.com/help/start/account-verification/what-is-domain-verification)
- [Railway custom domains](https://docs.railway.com/networking/domains/working-with-domains)
