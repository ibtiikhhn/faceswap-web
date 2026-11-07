import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { faceSwapTemplates, findFaceSwapTemplate } from '../src/lib/face-swap-templates';

describe('template editor handoff', () => {
  it('only resolves known template IDs, never caller-provided image URLs or paths', () => {
    for (const input of [undefined, '', '../privacy', '/images/examples/source.webp', 'https://example.com/private.jpg']) {
      expect(findFaceSwapTemplate(input)).toBeUndefined();
    }
    expect(findFaceSwapTemplate('hillside')?.src).toBe('/images/examples/hillside-target.webp');
  });

  it('serves supported, distinct target images with the dimensions promised in the library', async () => {
    for (const template of faceSwapTemplates) {
      const image = await sharp(path.join(process.cwd(), 'public', template.src)).metadata();
      expect(image.format).toBe('webp');
      expect([image.width, image.height]).toEqual([template.width, template.height]);
      expect(template.src).not.toBe(template.result);
    }
  });
});
