# Custom Swap integration

Implemented from the supplied iOS-client contract on 3 October 2026. No API authentication is described by that contract. This implementation calls it only from the existing worker, behind app ownership, trial/subscription, credit reservation, rate limiting, and an explicit external-processing consent check.

## Railway configuration

Keep `APP_ENV=staging` while testing. On **both web and worker** set:

```dotenv
SWAP_PROVIDER=external
CUSTOM_SWAP_URL=https://faceswap-django.onrender.com/faceswap_file/
CUSTOM_SWAP_RESULT_HOSTS=img.theapi.app
```

The last value must be comma-separated **exact hostnames**, not URLs or wildcard domains. Include legitimate redirect destinations too. Obtain them from a real successful response and the provider. There is deliberately no guessed allowlist or unrestricted result download. External mode refuses to start without a configured allowlist. Remove or align an old `FACE_SWAP_PROVIDER=mock` alias if present. Keep `SWAP_PROVIDER=mock` until you have the real download hosts. Rebuild/redeploy after configuration changes so public copy and server settings stay aligned. Deploy the web release/migration first, then the updated worker. The release command must run the new `0008_swap_provider_consent.sql` migration before web/worker start. No new package is needed. The migration keeps existing jobs in mock mode and records external-processing permission on new jobs.

Existing R2 and database settings stay in use. Private source/target objects are read server-side; neither R2 credentials nor signed source-image URLs are sent to the provider. The adapter uploads JPEG bytes as multipart `source_image` and `target_image`.

## Processing and limits

- Correct orientation, resize to a maximum 2048px side, flatten transparency to white, encode JPEG at quality 80. The provider's maximum dimensions are undocumented; 2048px is our configurable-in-code input policy, not a documented provider limit.
- Submission timeout: 120 seconds per attempt. Three attempts for network failures, 429, or 503 with exponential delay and jitter. Other HTTP errors fail without retry; raw server errors are not exposed or logged.
- Bounded JSON response; use only `external_api_response.output[0]`.
- Download immediately; up to three download attempts, 30 seconds per attempt, maximum 20 MiB. Once the URL exists, download retries do not submit another swap.
- Require approved HTTPS hosts, reject private/non-public DNS answers, pin the validated address to the TLS connection, and revalidate each redirect (maximum three). TLS certificates remain checked against the original hostname.
- Decode JPEG/PNG/WebP, reject animated/unreadable images and excessive decoded pixel counts, strip metadata through WebP re-encoding, then save to the app's private storage with normal expiry/ownership rules.
- Only mock results get the development watermark. Real results have `mock:false` metadata and “Result” labels.
- Exhausted failures use the existing transactional credit/trial release path. Successful durable storage settles exactly one reservation.

The API provides no job ID, cancellation endpoint, status endpoint, or documented idempotency support. `custom_<app-job-id>` is a local correlation label only. A lost response or worker crash may cause another remote operation on retry; exactly-once remote processing cannot be promised. Each job stores its selected provider mode and, for external jobs, a consent timestamp. Switching the deployment to external mode will not send old mock jobs to the provider. Switching back to mock disables pending external work safely. The local job claim prevents concurrent app-level duplicate delivery, and credit settlement remains idempotent. The maximum configured network attempt window is below the queue's 600-second expiry and stale-job recovery's 15-minute threshold.

## Verification and rollout

Automated tests use generated colored images and mocked network responses; no customer photos are transmitted by tests. They cover multipart field order/type, JPEG conversion, rotation/resize, valid output, bounded retries, malformed response, bad output, and download-host/IP restrictions. A direct live API test on 8 October 2026 with two generated fictional portraits returned HTTP 200 and a valid downloaded result from `img.theapi.app` in about 28 seconds. The secure downloader and image normalization passed. This does not verify the deployed Railway/R2/account flow.

Before enabling public external processing, confirm the Custom Swap operator's identity, downstream processing, retention/deletion and training terms; these are absent from the supplied contract. The privacy page now describes the endpoint and these known limits rather than implying provider copies follow our R2 expiry rules. The studio obtains consent before external submission. Stripe is retired; Paddle integration is pending.

For a controlled end-to-end staging check: use two photos you have permission to process, check the consent box, submit one guest trial or an account with a valid test entitlement, confirm no mock watermark, verify the saved result can be downloaded from the app, and check credit/trial settlement. Do not send private URL tokens in logs or support screenshots.

## Policy update — 10 October 2026
The owner identified PiAPI as the underlying provider. The app continues to submit through this custom gateway. See LEGAL-LAUNCH-CHECKLIST.md for published PiAPI sources and outstanding gateway retention verification. Paddle is now integrated and sandbox testing was reported complete by the owner.
