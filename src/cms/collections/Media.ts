import type { CollectionConfig } from 'payload'
import { ownerOnly } from '@/cms/access'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'alt',
    group: 'Content',
  },
  access: {
    read: () => true,
    create: ownerOnly,
    update: ownerOnly,
    delete: ownerOnly,
  },
  upload: {
    staticDir: '.data/cms-media',
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    imageSizes: [
      {
        name: 'card',
        width: 800,
        height: 500,
        position: 'centre',
      },
      {
        name: 'social',
        width: 1200,
        height: 630,
        position: 'centre',
      },
    ],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
}
