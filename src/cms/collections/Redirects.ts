import type { CollectionConfig } from 'payload'
import { ownerOnly } from '@/cms/access'

export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from',
    group: 'Content',
  },
  access: {
    read: ownerOnly,
    create: ownerOnly,
    update: ownerOnly,
    delete: ownerOnly,
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      unique: true,
    },
    {
      name: 'to',
      type: 'text',
      required: true,
    },
    {
      name: 'permanent',
      type: 'checkbox',
      defaultValue: true,
    },
  ],
}
