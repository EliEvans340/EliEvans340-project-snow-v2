import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

function getAdapter() {
  if (!process.env.DATABASE_URL) {
    // Return undefined adapter during build time
    // This allows the build to complete; runtime will have DATABASE_URL set
    return undefined;
  }
  return DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  });
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: getAdapter(),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: {
    strategy: process.env.DATABASE_URL ? "database" : "jwt",
  },
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    session({ session, user, token }) {
      if (user) {
        session.user.id = user.id;
      } else if (token?.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
