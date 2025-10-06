
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as AppleStrategy } from 'passport-apple';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';

const prisma = new PrismaClient();
const authService = new AuthService();

// Google OAuth
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: `${process.env.API_URL}/api/v1/auth/oauth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await prisma.user.findUnique({
          where: { email: profile.emails![0].value },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: profile.emails![0].value,
              name: profile.displayName,
              photos: {
                create: [
                  {
                    url: profile.photos![0].value,
                    isMain: true,
                    moderationStatus: 'APPROVED',
                  },
                ],
              },
              gender: 'OTHER', // To be updated by user
              birthDate: new Date(), // To be updated by user
            },
          });
        }

        const tokens = authService['generateTokens'](user.id);
        done(null, { user, tokens });
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

// Facebook OAuth
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID!,
      clientSecret: process.env.FACEBOOK_APP_SECRET!,
      callbackURL: `${process.env.API_URL}/api/v1/auth/oauth/facebook/callback`,
      profileFields: ['id', 'displayName', 'photos', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await prisma.user.findUnique({
          where: { email: profile.emails![0].value },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: profile.emails![0].value,
              name: profile.displayName,
              photos: {
                create: [
                  {
                    url: profile.photos![0].value,
                    isMain: true,
                    moderationStatus: 'APPROVED',
                  },
                ],
              },
              gender: 'OTHER',
              birthDate: new Date(),
            },
          });
        }

        const tokens = authService['generateTokens'](user.id);
        done(null, { user, tokens });
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

// Apple OAuth
passport.use(
  new AppleStrategy(
    {
      clientID: process.env.APPLE_CLIENT_ID!,
      teamID: process.env.APPLE_TEAM_ID!,
      keyID: process.env.APPLE_KEY_ID!,
      callbackURL: `${process.env.API_URL}/api/v1/auth/oauth/apple/callback`,
      privateKeyLocation: './certs/apple-key.p8',
    },
    async (accessToken, refreshToken, idToken, profile, done) => {
      try {
        let user = await prisma.user.findUnique({
          where: { email: profile.email! },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              email: profile.email!,
              name: `${profile.name?.firstName} ${profile.name?.lastName}`,
              gender: 'OTHER',
              birthDate: new Date(),
            },
          });
        }

        const tokens = authService['generateTokens'](user.id);
        done(null, { user, tokens });
      } catch (error) {
        done(error as Error);
      }
    }
  )
);

export default passport;