import type { Access, Where } from 'payload'

export const ownerOnly: Access = ({ req }) => Boolean(req.user)

export const publishedOnly: Access = ({ req }) => {
  if (req.user) return true

  const where: Where = {
    and: [
      {
        _status: {
          equals: 'published',
        },
      },
      {
        publishedAt: {
          less_than_equal: new Date().toISOString(),
        },
      },
    ],
  }
  return where
}
