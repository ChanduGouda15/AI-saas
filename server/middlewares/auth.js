// server/middlewares/auth.js
import { clerkClient } from '@clerk/express'

const normalizePlan = (user) => {
  const raw = (
    user?.publicMetadata?.plan ??
    user?.privateMetadata?.plan ??
    ''
  )
    .toString()
    .trim()
    .toLowerCase()

  return ['premium', 'pro', 'paid'].includes(raw) ? 'premium' : 'free'
}

export const auth = async (req, res, next) => {
  try {
    const { userId } = await req.auth()
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' })
    }

    const user = await clerkClient.users.getUser(userId)

    req.userId = userId
    req.plan = normalizePlan(user)             // 'premium' | 'free'
    req.free_usage = user?.privateMetadata?.free_usage ?? 0

    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(500).json({ success: false, message: error.message })
  }
}
