// https://next-auth.js.org/providers/google

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import EmailProvider from 'next-auth/providers/email';
import { MongoDBAdapter } from '@next-auth/mongodb-adapter';
import { DefaultSession, User, TokenSet } from 'next-auth';
// import { compare } from "bcrypt";
// import CredentialsProvider from "next-auth/providers/credentials";

import clientPromise from './lib/mongodb';

const mongoAdapterOptions = {
  collections: {
    Accounts: 'nextauth_accounts',
    Sessions: 'nextauth_sessions',
    Users: 'nextauth_users',
    VerificationTokens: 'nextauth_verification_tokens',
  },
};

//GoogleProvider({
//  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
//  clientSecret: process.env.GOOGLE_OATH_SECRET || "",
//  authorization: {
//    params: {
//      prompt: "consent",
//      access_type: "offline",
//      response_type: "code"
//    }
//  }
//}),

export const authOptions = {
  adapter: MongoDBAdapter(clientPromise, mongoAdapterOptions),
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: process.env.EMAIL_SERVER_PORT,
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      // Log magic link to console in development
      async sendVerificationRequest({ identifier, url, provider }) {
        console.log('\n===== MAGIC SIGN-IN LINK =====');
        console.log(`Email: ${identifier}`);
        console.log(`Link:  ${url}`);
        console.log('================================\n');
        // Return successfully without actually sending email
        return Promise.resolve();
      },
    }),
  ],
  callbacks: {
    // @ts-expect-error
    async session({ session, user, token }) {
      session.user.name = '';
      session.user.image = '';
      return session;
    },
  },
  theme: {
    logo: '/logos/2023_logo_pink.svg',
    brandColor: '#4ab3ea',
    buttonText: '#fff',
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: true,
};

export default NextAuth(authOptions);
