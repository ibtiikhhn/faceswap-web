import { photoSwapGuideScreenshot } from '@/lib/photo-swap-guide';

export function PhotoSwapGuideFigures() {
  return <section className="guide-figures" aria-label="Photo swap walkthrough illustrations">
    <h2>Source, target, and result: a visual example</h2>
    <p>The source supplies the face; the target supplies the scene. This is the Paris example already published on our homepage, not a new test or a promise of the result your photos will produce.</p>
    <div className="guide-example-grid">
      <figure><img src="/images/examples/source.webp" alt="Source portrait supplying the face for the published example" width="320" height="414"/><figcaption>1. Source: the face to use.</figcaption></figure>
      <figure><img src="/images/examples/paris-target.webp" alt="Original target portrait beside the Eiffel Tower before the face swap" width="736" height="1075"/><figcaption>2. Target: the scene to appear in.</figcaption></figure>
      <figure><img src="/images/examples/paris-result.webp" alt="Published Paris face swap example with the source face in the target scene" width="736" height="1075"/><figcaption>3. Published example result. Results vary.</figcaption></figure>
    </div>
    <figure className="guide-editor-figure"><img src={photoSwapGuideScreenshot} alt="SwapThisFace editor showing Upload your face on the left, Upload a target photo in the middle, and the result panel on the right" width="1280" height="720"/><figcaption>The actual browser editor, captured October 31, 2026. Follow the source and target labels when adding your own photos.</figcaption></figure>
  </section>;
}
