import NextAuth from "next-auth"
import EmailProvider from "next-auth/providers/email"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import clientPromise from "@/lib/mongodb"

const mongoAdapterOptions = {
  collections: {
    Accounts: 'nextauth_accounts',
    Sessions: 'nextauth_sessions',
    Users: 'nextauth_users',
    VerificationTokens: 'nextauth_verification_tokens',
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: MongoDBAdapter(clientPromise, mongoAdapterOptions) as any,
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
      async sendVerificationRequest({ identifier, url, provider }) {
        // Development: log to console
        console.log('\n===== MAGIC SIGN-IN LINK =====');
        console.log(`Email: ${identifier}`);
        console.log(`Link:  ${url}`);
        console.log('================================\n');
        return Promise.resolve();
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      // Privacy: clear name and image
      if (session.user) {
        session.user.name = '';
        session.user.image = '';
      }
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
})
