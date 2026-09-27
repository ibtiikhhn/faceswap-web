# SwapThisFace.com legal launch checklist

Updated 27 September 2026. Public pages are detailed staging drafts, not jurisdiction-reviewed final paid-service terms.

## Confirmed
- Operator supplied by owner: Codeflow Solutions.
- Support and privacy contact supplied by owner: jasperburges0@gmail.com.
- Google sign-in, Railway hosting, Neon database, Cloudflare R2 storage.
- Stripe and external face-swap provider integration deferred.
- Original asset expiry: 24 hours from upload; result expiry: guests 24 hours, accounts 30 days. Guest claim extends result expiry.
- Account deletion disables access and queues photo removal; it does not automatically erase/anonymize all structured records.
- Google Fonts and Unsplash assets make external browser requests. Revisit if assets become self-hosted.

## Complete before public launch
1. Confirm full legal operator name/form, operating country, service/contact address, target markets, and an appropriate age policy. Have terms reviewed for those jurisdictions; do not infer governing law from the domain or hosting region.
2. Set a concrete non-photo retention schedule for accounts, guest records, job metadata, logs, support correspondence, payment/audit records, and backups. Implement manual deletion handling and/or automated erasure to match it. Record exceptions and review dates.
3. Verify provider contracts, deployment regions, subprocessors, and applicable international-transfer mechanisms. Update privacy section 11 with actual arrangements.
4. Review the face-swap provider's data usage, biometric processing, storage duration, training practices, deletion support, and permitted-use rules before sending photos. Identify the provider in the policy. Add any required consent before processing.
5. Confirm subscription prices/currencies/allowances, taxes, renewal disclosures, customer cancellation flow, refund rules, statutory withdrawal rights, and any immediate-delivery consent. Test webhook/payment failure/reversal flows. Do not charge from staging.
6. Establish support processes for privacy requests, impersonation/NCII reports, complaints, security incidents, and account closure while subscription remains active. Self-service billing checks cannot be the only way to exercise privacy rights.
7. Review paid credit treatment on closure/suspension and merchant payment restrictions for this service.
8. Reconcile policy promises against production configuration and behavior, then remove staging-only caveats and date the final version. Keep version history and evidence of acceptance where required.
9. Keep staging noindex. Keep production and staging credentials/data separate. Publish production canonical URLs and the keyword mapping only when the launch domain is ready.

## Reference guidance consulted
These sources inform transparency and checkout review; they do not establish which country's law applies to this business.
- [ICO — right to be informed](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/): explain processing purposes, recipients, and retention in understandable language.
- [FTC — subscription rule review, March 2026](https://www.ftc.gov/news-events/news/press-releases/2026/03/ftc-seeks-public-comment-response-advance-notice-proposed-rulemaking-regarding-negative-option): clear terms, consent, and accessible cancellation remain important concerns; the 2024 rule was vacated and should not be described as the current operative rule.
