import Link from 'next/link';

export function PhotoSwapWorkflow() {
  return <>
    <section className="photo-guide" aria-labelledby="photo-workflow-title">
      <div className="section-heading"><div><div className="eyebrow">SOURCE → TARGET → RESULT</div><h2 id="photo-workflow-title">How to swap faces between two photos</h2></div></div>
      <div className="steps-grid">
        <article className="step-card"><h3>1. Choose your source face</h3><p>Upload a clear portrait under “Your face.” This is the person whose face you want in the finished picture. Keep the eyes, nose and mouth visible.</p></article>
        <article className="step-card"><h3>2. Upload the target photo</h3><p>Add the picture you want to change under “Your new look.” The target supplies the pose, clothing and setting. Make a <Link href="/custom-face-swap">custom swap with your own target</Link> or start with a <Link href="/templates">face swap template</Link>.</p></article>
        <article className="step-card"><h3>3. Compare and download</h3><p>Create the swap, move the comparison slider to inspect the result, then select Download. Check the face and surrounding details before saving the image.</p></article>
      </div>
      <p className="guide-links">Need the full walkthrough? Follow the <Link href="/blog/how-to-swap-a-face-between-two-photos">guide to swapping a face from one photo to another</Link>.</p>
    </section>
    <section className="guide-figures photo-guide" aria-labelledby="photo-example-title">
      <h2 id="photo-example-title">Photo face swap example: which image goes where?</h2>
      <p className="guide-intro">In this published Paris example, the portrait supplies the face and the Eiffel Tower photo supplies the scene. Open each image to compare it at full size.</p>
      <div className="guide-example-grid">
        <figure><a href="/images/examples/source.webp"><img src="/images/examples/source.webp" width="320" height="414" loading="lazy" alt="Source portrait supplying the face for the Paris photo swap"/></a><figcaption>Source: upload this under “Your face.”</figcaption></figure>
        <figure><a href="/images/examples/paris-target.webp"><img src="/images/examples/paris-target.webp" width="736" height="1075" loading="lazy" alt="Target photo of a person beside the Eiffel Tower before face replacement"/></a><figcaption>Target: upload this under “Your new look.”</figcaption></figure>
        <figure><a href="/images/examples/paris-result.webp" download><img src="/images/examples/paris-result.webp" width="736" height="1075" loading="lazy" alt="Photo face swap result with the source face in the Paris target scene"/></a><figcaption>Result: select the image to download this example.</figcaption></figure>
      </div>
      <p className="guide-links">Results vary with your photo pair. See more <Link href="/examples">source, target and result examples</Link>, or learn what to check for a <Link href="/realistic-face-swap">natural-looking face swap</Link>.</p>
    </section>
    <section className="photo-guide" aria-labelledby="photo-files-title"><h2 id="photo-files-title">Supported photo formats and downloads</h2><p className="guide-intro">Use JPG, PNG or WebP files up to 10 MB per image. Convert HEIC photos before uploading, and choose original files instead of compressed screenshots where possible. The editor works in a phone or desktop browser; no app installation is needed.</p><p className="guide-links">After processing, use the result’s Download button to save a copy. Download images you want to keep: photos are stored until you delete them. See the <Link href="/privacy">photo storage details</Link>.</p></section>
  </>;
}

export function PhotoSwapFaq() {
  return <section className="faq photo-faq" aria-labelledby="photo-faq-title"><h2 id="photo-faq-title">Photo face swap FAQs</h2>
    <details><summary>How do I replace a face in an existing photo?</summary><p>Use the existing picture as your target and a portrait of the replacement face as your source. The <Link href="/face-changer">AI face changer</Link> handles the replacement after you upload both images. You do not need to cut out a face, create layers or use Photoshop.</p></details>
    <details><summary>Can I try photo face swap online for free?</summary><p>Yes. You can try one successful guest swap without creating an account. Continued use requires signing in and using credits. The trial does not start a subscription, and free access is not unlimited.</p></details>
    <details><summary>Can I copy a face from one picture to another?</summary><p>Yes—that is the source-and-target workflow above. The output is a generated face replacement, rather than an exact cut-and-paste copy of the source pixels. Compare it with both originals to check the resemblance.</p></details>
    <details><summary>Does photo face swap keep the target’s hair and background?</summary><p>The target supplies the starting hairstyle, outfit, pose and background. Inspect those areas in the finished result for unintended changes. To choose a different scene or outfit, upload a different target photo.</p></details>
    <details><summary>How do I get a more realistic photo face swap?</summary><p>Use sharp faces with similar head angles, expressions and lighting. Review the eyes, mouth, skin transitions and jawline at full size. The <Link href="/realistic-face-swap">realistic face swap checklist</Link> helps you choose inputs and inspect the output.</p></details>
    <details><summary>Can I swap multiple faces in a photo?</summary><p>Yes. <Link href="/multiple-face-swap">Automatic multiple-face swapping</Link> is supported. The tool automatically chooses the face or faces that fit best, so some may stay unchanged. Review each person in the result. This is different from manually assigning a separate source portrait to each face.</p></details>
    <details><summary>Can I swap faces in videos or animated GIFs?</summary><p>This editor accepts still photos. It does not process video clips, animated GIFs or live camera feeds.</p></details>
    <details><summary>Can I use photo face swap on iPhone or Android?</summary><p>Yes. Open the editor in your phone’s browser and upload JPG, PNG or WebP images up to 10 MB each. Convert HEIC files first. The <Link href="/blog/how-to-swap-faces-on-iphone">iPhone guide</Link> and <Link href="/blog/how-to-swap-faces-on-android">Android guide</Link> explain how to select photos and save the result.</p></details>
    <details><summary>Are my uploaded photos public?</summary><p>No. Uploads are not published in a public gallery. Photos are processed through our service infrastructure and face-swap provider; photos are stored until you delete them. Only upload images you have permission to use. Read the <Link href="/privacy">processing and deletion details</Link>.</p></details>
  </section>;
}
