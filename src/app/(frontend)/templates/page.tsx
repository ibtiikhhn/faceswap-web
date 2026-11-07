import Link from 'next/link';
import { pageMetadata, absoluteUrl, serializeJsonLd } from '@/lib/seo';
import { faceSwapTemplates } from '@/lib/face-swap-templates';

export const metadata = pageMetadata('Face Swap Templates — Pick a Photo, Add Your Face', 'Choose a travel or portrait face swap template. Open it in the editor, add your selfie, and compare the result with real examples from each scene.', '/templates');

export default function Templates() {
  return <div className="wrap quality-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Face swap templates',
      url: absoluteUrl('/templates'),
      mainEntity: { '@type': 'ItemList', itemListElement: faceSwapTemplates.map((item, index) => ({
        '@type': 'ListItem', position: index + 1, name: item.title, url: absoluteUrl('/templates#' + item.id),
      })) },
    }) }} />
    <header className="page-header"><h1>Pick a face swap template. Bring your selfie.</h1>
      <p>Choose the scene you want to recreate. Each template opens in the photo editor with the target already selected, ready for your face. Browse five travel and portrait photos with notes on head angle, framing, and what to inspect in the result.</p>
    </header>
    <nav className="example-nav" aria-label="Choose a template">{faceSwapTemplates.map(item => <a key={item.id} href={'#' + item.id}>{item.title}</a>)}</nav>
    {faceSwapTemplates.map(item => <section className="quality-section" id={item.id} key={item.id}>
      <h2>{item.title}</h2>
      <div className="quality-columns">
        <figure style={{ margin: 0 }}><a href={item.src}><img src={item.src} alt={item.title + ' original target photo for a face swap'} width={item.width} height={item.height} loading="lazy" style={{ width: '100%', height: 420, objectFit: 'contain', background: 'var(--canvas)' }} /></a><figcaption className="quality-caption">Original target · {item.width} × {item.height} pixels</figcaption></figure>
        <div><p>{item.scene}</p><h3>Try it for</h3><p>{item.use}</p><h3>Choose your source photo</h3><p>{item.check}</p>
          <Link href={'/face-swap?template=' + item.id} className="button button-dark">Use this template</Link>
          <p><Link href={'/examples#' + item.id}>See the source and an existing result</Link></p>
        </div>
      </div>
    </section>)}
    <section className="quality-section"><h2>How to use a face swap template</h2>
      <ol className="quality-steps">
        <li><h3>Choose the setting and pose</h3><p>The target determines the composition you start with. Choose the city, coast or portrait framing you like, then open “Use this template.” Wait for the target preview to load in the editor.</p></li>
        <li><h3>Add a compatible face photo</h3><p>Upload your source selfie under “Your face.” Pick one clear face with visible eyes and mouth. Match the target’s head turn where possible. The woodland portrait has a stronger turn than the hillside scene, so the same selfie may work differently with each.</p></li>
        <li><h3>Create and compare</h3><p>Review the processing notice and generate your swap. Use the comparison slider to inspect the result against the target. Check resemblance, facial edges, expression and the surrounding scene before downloading.</p></li>
      </ol>
    </section>
    <section className="quality-section"><h2>Choose a template by the face, too</h2>
      <p>A scene can look appealing while offering little detail in its face. The hillside photograph leaves room for a caption above the landscape, but the person occupies a smaller part of the frame. Inspect that face at full size before deciding whether it suits a portrait you want to share close up.</p>
      <p>The woodland photograph gives you a larger face to inspect. Its turned pose and scarf create an edge that deserves attention. Compare the cheek and eye with your source instead of judging only the outfit or the setting.</p>
      <p>If your first result needs improvement, change one input at a time. Keep the template and try a different selfie. If several sources struggle at the same boundary, choose a target with a clearer face. Our <Link href="/blog/how-to-make-face-swap-look-realistic">realistic face swap guide</Link> shows both scenes and explains the review.</p>
    </section>
    <section className="quality-section faq"><h2>Face swap template questions</h2>
      <h3>What is a face swap template?</h3><p>It is a target photo prepared for you to put a face into. The original photo establishes the scene and pose. You supply a separate face photo and review the generated result.</p>
      <h3>Can I upload my own target instead?</h3><p>Yes. Use the target upload in the editor to replace the selected template. Choose a JPG, PNG or WebP image up to 10 MB with one clearly visible face, and confirm you have permission to use the photos.</p>
      <h3>Are the examples a promise of my result?</h3><p>The linked gallery shows existing outputs made with its displayed source portrait. Your selfie can differ in expression, angle and lighting. Compare your own output at full size before deciding to keep it.</p>
      <h3>Can I use a template for a meme?</h3><p>Yes. Choose a scene with a recognizable face and room for a short joke. Generate the photo, download it, then add the words in a text-capable image editor. Our <Link href="/face-swap-for-memes">face swap meme page</Link> includes a finished example and caption ideas.</p>
      <h3>Can I try a template for free?</h3><p>You can use the current guest offer of one successful photo swap. Further swaps use credits from an available plan or pack. Check <Link href="/pricing">pricing</Link> before planning a set of variations.</p>
    </section>
  </div>;
}
