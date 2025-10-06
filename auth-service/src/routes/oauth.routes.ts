//services/auth-service/src/routes/oauth.routes.ts`typescript


import { Router } from 'express';
import passport from '../services/oauth.service';

const router = Router();

// Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  session: false,
}));

router.get('/google/callback', 
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const { user, tokens } = req.user as any;
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  }
);

// Facebook OAuth
router.get('/facebook', passport.authenticate('facebook', {
  scope: ['email'],
  session: false,
}));

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false }),
  (req, res) => {
    const { user, tokens } = req.user as any;
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`
    );
  }
);

// Apple OAuth
router.get('/apple', passport.authenticate('apple', {
  scope: ['name', 'email'],
  session: false,
}));

router.post('/apple/callback',
  passport.authenticate('apple', { session: false }),
  (req, res) => {
    const { user, tokens } = req.user as any;
    res.json({ user, ...tokens });
  }
);

export default router;