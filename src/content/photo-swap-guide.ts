import { photoSwapGuideSlug } from '@/lib/photo-swap-guide';

const text = (value: string) => ({ type: 'text', version: 1, text: value, detail: 0, format: 0, mode: 'normal' as const, style: '' });
const paragraph = (value: string) => ({ type: 'paragraph', version: 1, direction: null, format: '' as const, indent: 0, children: [text(value)] });
const heading = (value: string) => ({ type: 'heading', tag: 'h2', version: 1, direction: null, format: '' as const, indent: 0, children: [text(value)] });
const linkedParagraph = (before: string, label: string, url: string, after = '') => ({ type: 'paragraph', version: 1, direction: null, format: '' as const, indent: 0, children: [text(before), { type: 'link', version: 3, direction: null, format: '' as const, indent: 0, fields: { linkType: 'custom', url, newTab: false }, children: [text(label)] }, text(after)] });

export const photoSwapGuide = {
  title: 'How to Swap a Face in Another Photo: Step by Step',
  slug: photoSwapGuideSlug,
  summary: 'Put your face on another picture with two photos and a browser. Learn which image goes where, how to create and download a swap, and what to check when the result needs work.',
  seoTitle: 'How to Swap a Face in Another Photo: Step by Step',
  seoDescription: 'Learn how to put your face on another picture with two photos. Follow the upload, comparison and download steps, plus practical photo-selection tips.',
  content: { root: { type: 'root', version: 1, direction: null, format: '' as const, indent: 0, children: [
    paragraph('To swap a face from one photo to another, upload the face you want to use as the source and the picture you want to appear in as the target. Create the swap, inspect the result, and download it. You do not need Photoshop, manual cutouts, or a text prompt.'),
    paragraph('This guide covers SwapThisFace’s single-face photo editor. It does not cover group-photo swaps, video, GIFs, or live camera effects. The illustration above shows an existing homepage example; the instructions below describe the current editor rather than a newly measured quality test.'),
    heading('Before you start: choose two suitable photos'),
    paragraph('Use a source selfie or portrait with one clearly visible face. Start with a sharp original, even lighting, and visible eyes, nose, and mouth. Avoid sunglasses, heavy filters, and hands or hair covering the face.'),
    paragraph('Choose a target with one visible face and a head angle close to your source. The target is where you choose the outfit, pose, and setting. A tiny or distant target face gives the model less detail to work with. Enlarging a blurred image does not restore that detail.'),
    paragraph('Both files must be JPG, PNG, or WebP and no larger than 10 MB each. If your phone provides a HEIC image, export a copy in a supported format before uploading. Keep the original photos so you can try a different pair without losing them.'),
    linkedParagraph('Use only photos you have permission to edit, including permission from the people shown. Review the ', 'photo-processing and retention details', '/privacy#photos', ' before submitting. The live editor asks you to confirm that you are at least 18 and agree to the stated processing.'),
    heading('1. Open the editor and add your source face'),
    linkedParagraph('Open the ', 'photo face swap editor', '/face-swap', ' in your desktop or mobile browser. Under “Your face,” select “Upload your face” or “Browse photos,” then choose the portrait that supplies the face.'),
    paragraph('Check the preview before proceeding. If the selected image is the travel scene or costume picture you wanted to appear in, you have chosen the target for the source slot. Replace it with your source portrait.'),
    heading('2. Upload the target picture'),
    paragraph('Under “Your new look,” choose “Upload a target photo.” Select the scene you want to appear in. For example, in the illustration above the close-up portrait is the source and the Eiffel Tower portrait is the target.'),
    paragraph('Check that the target has one visible face. Choose a different image if the face is too small, turned far away, or covered. Matching angles and lighting can improve the starting point, but they do not guarantee a particular result.'),
    heading('3. Review the processing notice and create the swap'),
    paragraph('Read the processing notice below the result panel. Confirm it only if it applies to you and your photos, then select “Swap my face.” If you change either photo, review and confirm the notice again. The button remains unavailable until the required inputs and confirmation are ready.'),
    paragraph('Keep the page open while the editor processes the images. The status message shows the current stage. Avoid starting another job just because the first one is still running. Processing time varies; this guide does not promise a fixed completion time.'),
    linkedParagraph('The guest offer is one successful photo swap without an account. It is not unlimited free access or a subscription enrollment. For continued use, see the current ', 'plans and credit packs', '/pricing', '. A failed job releases the reserved credit or guest attempt.'),
    heading('4. Compare the result with your target'),
    paragraph('When the result appears, move the comparison slider to inspect the original target and the output. Check the eyes, mouth, skin tone, face edges, and hairline. Look at the rest of the scene too: review the output for unintended changes rather than assuming the pose or background is perfectly preserved.'),
    paragraph('A plausible face swap depends on both inputs and the processing model. If the editor labels an output “Preview,” treat it as a development preview rather than a completed production face swap.'),
    heading('5. Download the image you want to keep'),
    paragraph('Select “Download” beneath the completed comparison. On a phone, check your browser’s download location and use your device’s normal save or share controls. Open the saved file to confirm that you downloaded the output you intended.'),
    linkedParagraph('Download results you want to keep rather than relying on permanent online storage. Originals expire after 24 hours; the published policy describes 24-hour guest results and 30-day account results. Review the current ', 'retention and deletion policy', '/privacy', ' for details.'),
    heading('If the upload fails or the face swap looks wrong'),
    paragraph('Unsupported file: export a JPG, PNG, or WebP copy. Renaming a file extension does not convert its contents. If the image is over 10 MB, reduce the file size while keeping enough detail in the face.'),
    paragraph('Swap button unavailable: check that both photos have loaded, the service is ready, and the processing confirmation is selected. If an error message is shown, follow that message before trying again.'),
    paragraph('Blurry face: try the original photo instead of a compressed screenshot. A large image can still contain a tiny face; look at the facial detail rather than the file dimensions alone.'),
    paragraph('Unnatural edges or expression: try photos with closer head angles and lighting. Change one input at a time so you can compare what changed. More attempts do not guarantee that an unsuitable pair will work.'),
    paragraph('Multiple people or a hidden face: choose a single-person target with an unobstructed face. This version does not offer controls for replacing several people in a group image.'),
    linkedParagraph('Still stuck? Use the support contact in the site footer and describe the error. Avoid sending private face photos unless support specifically needs them and you are comfortable sharing. For a new attempt, return to the ', 'editor', '/face-swap', ' and choose another pair.'),
    heading('Can I do this without Photoshop or an app?'),
    paragraph('Yes. The browser workflow uses two photos and does not require Photoshop layers, manual masking, an app download, or an APK. On iPhone and Android, use a supported image format and inspect the saved result after downloading. A separate mobile walkthrough will cover device-specific steps once tested.'),
    heading('Choose the target for the picture you want to make'),
    paragraph('A face swap replaces the face within an existing composition. It is different from generating a new scene from a prompt or blending two faces into a morph. If you want a different outfit, background, or pose, choose a different target image first.'),
    linkedParagraph('Ready to try your own pair? ', 'Open the photo face swap editor', '/face-swap', ', add a clear source portrait and a suitable target, and inspect the result before sharing it.'),
  ] } },
};
