import { Router } from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import { Strategy as FacebookStrategy } from 'passport-facebook'
import { Strategy as OpenIDConnectStrategy } from 'passport-openidconnect'
import { get, run } from '../db.js'
import { signToken } from '../middleware/auth.js'

const router = Router()

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

const scope = (s) => String(s || '')

/**
 * Find an existing user by email, otherwise create a new applicant account.
 * Social sign-ins default to the `applicant` role (users can pick a different
 * role by registering normally).
 */
async function findOrCreateSocialUser(provider, email, name) {
  const cleanEmail = String(email || '').trim().toLowerCase()
  if (!cleanEmail) return null

  let user = await get('SELECT * FROM users WHERE lower(email) = lower(?)', cleanEmail)
  if (user) return user

  const unusableHash = `social-${provider}-${Date.now()}`
  const id = await run(
    'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    String(name || '').trim() || cleanEmail.split('@')[0],
    cleanEmail,
    unusableHash,
    'applicant'
  )
  await run(
    'INSERT INTO applicant_profiles (user_id, course, year_level, phone) VALUES (?, ?, ?, ?)',
    id,
    '',
    '',
    ''
  )
  user = { id, name: String(name || '').trim() || cleanEmail.split('@')[0], email: cleanEmail, role: 'applicant' }
  return user
}

function makeVerify(provider) {
  if (provider === 'yahoo') {
    return async (issuer, uiProfile, jwtClaims, idToken, profile, done) => {
      try {
        const email = profile?.emails?.[0]?.value || profile?.emails?.[0]
        const name = profile?.displayName || profile?.name?.givenName || ''
        const user = await findOrCreateSocialUser(provider, email, name)
        if (!user) return done(new Error('We could not retrieve an email from your account.'), null)
        done(null, user)
      } catch (err) {
        done(err, null)
      }
    }
  }
  return async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile?.emails?.[0]?.value || profile?.emails?.[0]
      const name = profile?.displayName || profile?.name?.givenName || ''
      const user = await findOrCreateSocialUser(provider, email, name)
      if (!user) return done(new Error('We could not retrieve an email from your account.'), null)
      done(null, user)
    } catch (err) {
      done(err, null)
    }
  }
}

const googleEnabled = scope(process.env.GOOGLE_CLIENT_ID) && scope(process.env.GOOGLE_CLIENT_SECRET)
if (googleEnabled) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/google/callback`,
        scope: ['email', 'profile']
      },
      makeVerify('google')
    )
  )
}

const facebookEnabled = scope(process.env.FACEBOOK_APP_ID) && scope(process.env.FACEBOOK_APP_SECRET)
if (facebookEnabled) {
  passport.use(
    'facebook',
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/facebook/callback`,
        profileFields: ['id', 'emails', 'name']
      },
      makeVerify('facebook')
    )
  )
}

const yahooEnabled = scope(process.env.YAHOO_CLIENT_ID) && scope(process.env.YAHOO_CLIENT_SECRET)
if (yahooEnabled) {
  passport.use(
    'yahoo',
    new OpenIDConnectStrategy(
      {
        issuer: 'https://login.yahoo.com',
        clientID: process.env.YAHOO_CLIENT_ID,
        clientSecret: process.env.YAHOO_CLIENT_SECRET,
        callbackURL: `${SERVER_URL}/api/auth/yahoo/callback`,
        scope: ['openid', 'profile', 'email']
      },
      makeVerify('yahoo')
    )
  )
}

function redirectHome(req, res) {
  const token = signToken(req.user)
  res.redirect(`${CLIENT_URL}/login?token=${encodeURIComponent(token)}`)
}

router.get('/google', (req, res, next) => {
  if (!googleEnabled) return res.status(501).json({ error: 'Google sign-in is not configured on the server' })
  passport.authenticate('google', { session: false })(req, res, next)
})

router.get(
  '/google/callback',
  (req, res, next) => {
    if (!googleEnabled) return res.status(501).json({ error: 'Google sign-in is not configured on the server' })
    passport.authenticate('google', { session: false, failureRedirect: `${CLIENT_URL}/login?error=social` })(req, res, next)
  },
  redirectHome
)

router.get('/facebook', (req, res, next) => {
  if (!facebookEnabled) return res.status(501).json({ error: 'Facebook sign-in is not configured on the server' })
  passport.authenticate('facebook', { session: false })(req, res, next)
})

router.get(
  '/facebook/callback',
  (req, res, next) => {
    if (!facebookEnabled) return res.status(501).json({ error: 'Facebook sign-in is not configured on the server' })
    passport.authenticate('facebook', { session: false, failureRedirect: `${CLIENT_URL}/login?error=social` })(req, res, next)
  },
  redirectHome
)

router.get('/yahoo', (req, res, next) => {
  if (!yahooEnabled) return res.status(501).json({ error: 'Yahoo sign-in is not configured on the server' })
  passport.authenticate('yahoo', { session: false })(req, res, next)
})

router.get(
  '/yahoo/callback',
  (req, res, next) => {
    if (!yahooEnabled) return res.status(501).json({ error: 'Yahoo sign-in is not configured on the server' })
    passport.authenticate('yahoo', { session: false, failureRedirect: `${CLIENT_URL}/login?error=social` })(req, res, next)
  },
  redirectHome
)

export default router