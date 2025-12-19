import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    emailVerified: Date | null;
    name?: string | null;
    image?: string | null;

    // Admin role (from environment variable)
    isAdmin?: boolean;

    // Verification badges (from profile)
    panaVerified?: boolean;
    legalAgeVerified?: boolean;

    // Scoped roles (from profile)
    isMentoringModerator?: boolean;
    isEventOrganizer?: boolean;
    isContentModerator?: boolean;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      emailVerified: Date | null;
      name?: string | null;
      image?: string | null;

      // Admin role (from environment variable)
      isAdmin: boolean;

      // Verification badges (from profile)
      panaVerified: boolean;
      legalAgeVerified: boolean;

      // Scoped roles (from profile)
      isMentoringModerator: boolean;
      isEventOrganizer: boolean;
      isContentModerator: boolean;
    } & DefaultSession['user'];
  }
}
