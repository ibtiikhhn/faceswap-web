// Manual live test only: sends the two explicitly supplied local images to Custom Swap.
// Host discovery is confined to this script; production always uses its configured allowlist.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { customSwap } from '../src/server/swaps/providers/custom';
import { downloadResult } from '../src/server/swaps/providers/result-download';

const [sourcePath, targetPath, outputDirectory] = process.argv.slice(2);
if (!sourcePath || !targetPath || !outputDirectory) throw new Error('Usage: node --import tsx scripts/test-custom-swap-live.ts SOURCE TARGET OUTPUT_DIRECTORY');
const source = await readFile(sourcePath);
const target = await readFile(targetPath);
const hosts = new Set<string>();
const start = Date.now();
const result = await customSwap({
  source, target,
  endpoint: 'https://faceswap-django.onrender.com/faceswap_file/',
  resultHosts: ['live-test-host-discovery.invalid'],
}, {
  fetch: async (url, options) => {
    console.log('Submitting synthetic test photos to Custom Swap');
    const response = await fetch(url, options);
    console.log('Provider HTTP status:', response.status);
    return response;
  },
  pause: ms => new Promise(resolve => setTimeout(resolve, ms)),
  download: async raw => {
    const host = new URL(raw).hostname;
    hosts.add(host);
    console.log('Observed result hostname:', host);
    // Still enforces HTTPS, public DNS, pinned TLS, file size and redirect restrictions.
    return downloadResult(raw, [...hosts]);
  },
});
await mkdir(outputDirectory, { recursive: true });
const resultPath = path.join(outputDirectory, 'result.webp');
await writeFile(resultPath, result);
await writeFile(path.join(outputDirectory, 'verification.json'), JSON.stringify({
  verifiedAt: new Date().toISOString(), resultHosts: [...hosts], bytes: result.length,
  elapsedMs: Date.now() - start, resultPath,
  note: 'Direct provider and secure-download test. Does not verify Railway, R2, OAuth or app entitlements.',
}, null, 2));
console.log(JSON.stringify({ resultHosts: [...hosts], bytes: result.length, elapsedMs: Date.now() - start, resultPath }));
