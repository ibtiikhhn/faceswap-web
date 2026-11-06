import type { SerializedLinkNode, SerializedTextNode } from '@payloadcms/richtext-lexical';
import type { JSXConvertersFunction } from '@payloadcms/richtext-lexical/react';

// An editor can insert a caption as a standalone link to one of these gallery images.
const dimensions = new Map<string, [number, number]>([
  ['/images/examples/hillside-result.webp', [736, 920]],
  ['/images/examples/woodland-result.webp', [737, 1319]],
  ['/images/examples/scenic-route-meme.webp', [736, 1036]],
]);

export const articleExampleImages: JSXConvertersFunction = ({ defaultConverters }) => ({
  ...defaultConverters,
  paragraph: ({ node, nodesToJSX }) => {
    const child = node.children.length === 1 ? node.children[0] : undefined;
    if (child?.type === 'link') {
      const link = child as SerializedLinkNode;
      const url = link.fields.url ?? '';
      const size = dimensions.get(url);
      const label = link.children.length === 1 ? link.children[0] : undefined;
      const caption = label?.type === 'text' && (label as SerializedTextNode).text;
      if (size && typeof caption === 'string' && caption) {
        return <figure><a href={url}><img src={url} width={size[0]} height={size[1]} alt={caption} loading="lazy" style={{ maxWidth: '100%', height: 'auto' }} /></a><figcaption>{caption}</figcaption></figure>;
      }
    }
    const children = nodesToJSX({ nodes: node.children });
    return <p>{children.length ? children : <br />}</p>;
  },
});
