import fs from 'node:fs/promises';
import sharp from 'sharp';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Aperture } from 'lucide-react';

// Reuse the site's existing aperture mark; keep the public icon URLs stable.
const mark = renderToStaticMarkup(createElement(Aperture, { size: 72, strokeWidth: 2.3, color: '#20231f' }));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><rect width="96" height="96" rx="24" fill="#d5ef78"/><g transform="translate(12 12)">${mark}</g></svg>`;
await fs.mkdir('public', { recursive: true });
await fs.writeFile('public/brand-mark.svg', svg);
for (const [name, size] of [['favicon-96.png', 96], ['apple-touch-icon.png', 180], ['icon-512.png', 512]] as const) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/${name}`);
}
// ICO with PNG frames, including 48px and 96px for search and 16/32px for browser tabs.
const sizes = [16, 32, 48, 96];
const frames = await Promise.all(sizes.map(size => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()));
const header = Buffer.alloc(6 + frames.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(frames.length, 4);
let offset = header.length;
frames.forEach((frame, i) => {
  const entry = 6 + i * 16;
  header[entry] = sizes[i]; header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await fs.writeFile('src/app/favicon.ico', Buffer.concat([header, ...frames]));
const share = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f7f8f3"/><circle cx="1090" cy="100" r="260" fill="#d5ef78"/><g transform="translate(72 66)">${mark}</g><text x="160" y="113" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#20231f">SwapThisFace.com</text><text x="72" y="290" font-family="Arial,sans-serif" font-size="76" font-weight="700" fill="#20231f">Recreate a photo</text><text x="72" y="385" font-family="Georgia,serif" font-size="82" font-style="italic" fill="#20231f">with your face.</text><text x="76" y="489" font-family="Arial,sans-serif" font-size="27" fill="#536144">AI photo face swap · Two photos. One new look.</text><rect x="76" y="537" width="310" height="5" rx="2" fill="#a8c551"/></svg>`;
await sharp(Buffer.from(share)).png().toFile('public/social-preview.png');
console.log('Generated favicon, Apple icon, brand mark, and social preview.');
