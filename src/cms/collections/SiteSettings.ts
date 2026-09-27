import type { GlobalConfig } from 'payload'
import { ownerOnly } from '@/cms/access'

export const SiteSettings: GlobalConfig = {
  slug: 'site-settings',
  admin: {
    group: 'Settings',
  },
  access: {
    read: () => true,
    update: ownerOnly,
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      required: true,
      defaultValue: 'SwapThisFace.com',
    },
    {
      name: 'defaultSeoTitle',
      type: 'text',
    },
    {
      name: 'defaultSeoDescription',
      type: 'textarea',
    },
  ],
}
