import type { Access } from 'payload'
import { publishedPostWhere } from './post-publication'

export const ownerOnly: Access = ({ req }) => Boolean(req.user)

export const publishedOnly: Access = ({ req }) => {
  if (req.user) return true

  return publishedPostWhere()
}
