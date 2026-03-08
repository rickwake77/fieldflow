// src/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Username/Email & Password login
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        login: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials?.password) return null;

        const login = credentials.login.toLowerCase().trim();

        // Try to find by email or username
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: login },
              { username: login },
            ],
          },
          include: { organisation: { select: { id: true, name: true } } },
        });

        if (!user || !user.active) return null;
        if (!user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: String(user.id),
          email: user.email || user.username || "",
          name: user.name,
          role: user.role,
          organisationId: user.organisationId,
          organisationName: user.organisation.name,
        };
      },
    }),

    // Magic link login (email users only)
    CredentialsProvider({
      id: "magic-link",
      name: "Magic Link",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.token) return null;

        const user = await prisma.user.findFirst({
          where: { email: credentials.email.toLowerCase().trim() },
          include: { organisation: { select: { id: true, name: true } } },
        });

        if (!user || !user.active) return null;
        if (!user.magicToken || !user.magicTokenExp) return null;

        if (user.magicToken !== credentials.token) return null;
        if (new Date() > user.magicTokenExp) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { magicToken: null, magicTokenExp: null },
        });

        return {
          id: String(user.id),
          email: user.email || user.username || "",
          name: user.name,
          role: user.role,
          organisationId: user.organisationId,
          organisationName: user.organisation.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.organisationId = (user as any).organisationId;
        token.organisationName = (user as any).organisationName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = Number(token.id);
        (session.user as any).role = token.role;
        (session.user as any).organisationId = token.organisationId;
        (session.user as any).organisationName = token.organisationName;
      }
      return session;
    },
  },
};
