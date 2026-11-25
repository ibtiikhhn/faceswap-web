import Link from 'next/link';
import { ArrowUpRight, ImagePlus, Layers } from './icons';

export function PhotoPossibilities() {
  return <section className="home-editorial wrap" aria-labelledby="put-your-face-title">
    <div className="editorial-intro">
      <div><div className="eyebrow">YOUR FACE. A DIFFERENT SETTING.</div><h2 id="put-your-face-title">Put your face on another picture.</h2></div>
      <div><p>Recreate a travel photo, try a new portrait style, or put yourself into a costume shot. An AI photo face swap takes the face from your source image and places it into a target picture. The <Link href="/face-changer">face changer guide</Link> explains what changes in the photo. Start with a clear photo of yourself and a target picture you have permission to edit.</p><p>The source photo supplies the face. The target photo supplies the scene you want to step into. Start with a target whose face angle is close to your source portrait. Clear facial detail makes the result easier to judge.</p><Link href="/face-swap" className="text-link">Choose your two photos <ArrowUpRight size={16}/></Link></div>
    </div>
    <div className="photo-roles" aria-label="Which photos to choose">
      <div className="photo-role"><ImagePlus size={24}/><div><span className="eyebrow">SOURCE PHOTO</span><h3>The face you want to use</h3><p>A sharp selfie or portrait with your eyes, nose, and mouth clearly visible. Skip heavy filters and anything covering your face.</p></div></div>
      <div className="photo-role"><Layers size={24}/><div><span className="eyebrow">TARGET PHOTO</span><h3>The photo you want to recreate</h3><p>Choose the composition, outfit, and setting you like. The faces should be large enough to see clearly, without hair, hands, or props hiding the features.</p></div></div>
    </div>
  </section>;
}

const ideas = [
  { number: '01', title: 'Compare realistic face swaps', text: 'Look at the source, target, and output together. Check resemblance, lighting, and facial edges before choosing your own photo pair.', tip: 'Review the realistic face swap guide', href: '/realistic-face-swap' },
  { number: '02', title: 'Put your face on a meme', text: 'Choose a scene that fits the joke, swap in your face, then add a caption in a separate image editor. Start with a finished example to see the steps.', tip: 'Explore face swap memes', href: '/face-swap-for-memes' },
  { number: '03', title: 'Choose a face swap template', text: 'Browse ready-to-use travel and portrait photos. Selecting a template opens the editor with the target already loaded; you supply the source portrait.', tip: 'Browse photo templates', href: '/templates' },
  { number: '04', title: 'Inspect before-and-after examples', text: 'See the original photos behind the published results. Compare the eyes, mouth, and surrounding scene instead of judging only a small preview.', tip: 'See source, target, and result', href: '/examples' },
];

export function PhotoIdeas() {
  return <section className="home-ideas" aria-labelledby="photo-ideas-title"><div className="wrap">
    <div className="section-heading"><div><div className="eyebrow">EXAMPLES AND STARTING POINTS</div><h2 id="photo-ideas-title">What will you make with AI face swap?</h2></div><p>Choose a scene, a template, or an example to inspect.</p></div>
    <div className="photo-ideas-grid">{ideas.map(idea => <article className="photo-idea" key={idea.number}><span className="idea-number">{idea.number}</span><h3>{idea.title}</h3><p>{idea.text}</p><Link href={idea.href} className="text-link">{idea.tip}<ArrowUpRight size={16}/></Link></article>)}</div>
  </div></section>;
}

export function HomeQualityGuide() {
  return <section className="wrap photo-guide" aria-labelledby="home-quality-title">
    <div className="section-heading"><div><div className="eyebrow">BEFORE YOU GENERATE</div><h2 id="home-quality-title">Choose photos for a realistic face swap.</h2></div></div>
    <div className="steps-grid">
      <article className="step-card"><h3>Match the head angle</h3><p>A forward-facing portrait gives you a different starting point from a side profile. Choose source and target faces with similar angles and expressions.</p></article>
      <article className="step-card"><h3>Look at the light</h3><p>Compare the bright and shadowed sides of each face. A heavily filtered selfie or a target in deep shadow can make a convincing match harder.</p></article>
      <article className="step-card"><h3>Check the facial detail</h3><p>Use the clearest originals you have. A large image can still contain a tiny face, so inspect the eyes and mouth before uploading.</p></article>
    </div>
    <p className="guide-links">After generating, compare the output with both inputs. Check resemblance, the jawline, and nearby hair or clothing. For a closer look, use the <Link href="/realistic-face-swap">realistic face swap checklist</Link>.</p>
  </section>;
}

export function PhotoEditingExplainer() {
  return <section className="home-editorial wrap" aria-labelledby="photo-editing-title"><div className="editorial-intro">
    <div><div className="eyebrow">KNOW WHAT YOU’RE CHANGING</div><h2 id="photo-editing-title">How does AI face swap work?</h2></div>
    <div><p>In an AI photo face swap, you provide a source face and an existing target image. You do not need to describe a new scene in a text prompt. Choosing the right target is how you choose the composition, clothing, and background you want to work with.</p><p>If you want a different outfit or setting, start with a different target photo. This editor does not provide background replacement, body reshaping, photo animation, or a tool for generating an entirely new scene.</p><p>Think of a realistic face swap as a question of fit: does the face belong with the pose, lighting, and expression in the target? Compare the result with the original and check the eyes, hairline, and edges before you download or share it.</p></div>
  </div><div className="home-privacy-note"><ShieldNote/><div><h3>Your photo choices stay in your control.</h3><p>Customer uploads are not posted to a public gallery. Originals expire 24 hours after upload; account results are retained for 30 days and guest results for 24 hours. Download anything you want to keep, and read the <Link href="/privacy">photo retention and deletion details</Link>.</p></div></div></section>;
}
function ShieldNote(){return <span className="privacy-note-icon"><ImagePlus size={23}/></span>;}

const homeQuestions = [
  { question: 'How does AI face swap work?', answer: <>The tool uses your source portrait as the face reference and your target photo as the scene. Upload both images, generate the swap, then compare the result with the originals. You choose the photos; you do not need a text prompt or manual cutout. Follow the <Link href="/blog/how-to-swap-a-face-between-two-photos">two-photo face swap tutorial</Link> for the upload and download steps.</> },
  { question: 'Can I try AI face swap for free without signing up?', answer: <>Yes. You can try one successful guest photo swap without creating an account. The trial does not start a subscription, and free access is not unlimited. Continued use requires signing in and using credits. A failed processing job releases the reserved trial or credit.</> },
  { question: 'Can AI face swap replace multiple faces in a photo?', answer: <>Yes. SwapThisFace supports <Link href="/multiple-face-swap">automatic multiple-face swapping</Link> in photos. The tool automatically chooses the face or faces that fit best, so some may stay unchanged. Use a clear target and review the output. Automatic swapping is different from manually assigning a separate source portrait to each person.</> },
  { question: 'Do I need an app to swap faces online?', answer: <>No. Use the AI face swap tool in your browser on a phone or computer. You can upload your own photos without installing an app or APK. Our <Link href="/blog/how-to-swap-faces-on-iphone">iPhone guide</Link> and <Link href="/blog/how-to-swap-faces-on-android">Android guide</Link> cover choosing files and saving the result.</> },
  { question: 'Which photos work best for a realistic AI face swap?', answer: <>Use a sharp source portrait with visible eyes, nose, and mouth. Choose a target with a similar head angle, expression, and lighting. Avoid heavy filters and faces hidden by hands or hair. The <Link href="/realistic-face-swap">realistic face swap guide</Link> shows what to inspect before and after generating.</> },
  { question: 'Can I use my own target photo instead of a template?', answer: <>Yes. Create a <Link href="/custom-face-swap">custom face swap with your own photos</Link> by uploading the picture you want to appear in as the target. Its pose, outfit, and setting provide the starting composition. If you need a starting point, choose one of our <Link href="/templates">face swap templates</Link>; you can replace it with your own photo in the editor.</> },
  { question: 'Which image formats does the face swap tool accept?', answer: <>Upload JPG, PNG, or WebP images up to 10 MB each. If your phone saves photos as HEIC, export them to a supported format first. Use the original file where possible rather than a compressed screenshot.</> },
  { question: 'Why does my AI face swap look blurry or unnatural?', answer: <>Check whether either input has a small, blurred, strongly turned, or partly hidden face. Compare the lighting and expression, then change one input at a time. More attempts with the same pair do not guarantee a better result. Use the <Link href="/blog/why-does-face-swap-look-fake">face swap troubleshooting guide</Link> to identify what to try next.</> },
  { question: 'Does this AI face swap tool work with videos or GIFs?', answer: <>The current tool works with still photos. Video clips, animated GIFs, and live camera swaps need different processing and are not supported here.</> },
  { question: 'Are my uploaded face photos public?', answer: <>No. Customer uploads are not published in a public gallery. Photos are processed through our service infrastructure and face-swap provider. Photos are stored until you delete them. Read the <Link href="/privacy">photo processing and deletion details</Link>, and only upload images you have permission to use.</> },
];

export function HomeFaq() {
  return <section className="wrap home-faq" aria-labelledby="home-faq-title"><div className="home-faq-intro"><div className="eyebrow">BEFORE YOUR FIRST SWAP</div><h2 id="home-faq-title">AI face swap FAQs.</h2><p>From your first two photos to a more realistic result: what to upload, how it works, and what to expect.</p><Link href="/face-swap" className="text-link">Try the AI face swap tool <ArrowUpRight size={16}/></Link></div><div className="faq home-faq-list">{homeQuestions.map(item => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section>;
}
