import NextAuth from 'next-auth';
import GithubProvider from 'next-auth/providers/github';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from './db/prisma';
import { sendEmail } from './sendEmail';
import Nodemailer from 'next-auth/providers/nodemailer';
import { PrismaClient, User } from '@prisma/client';
import { Adapter } from 'next-auth/adapters';
import * as bcrypt from 'bcrypt';

// fix: Record to delete does not exist. https://github.com/nextauthjs/next-auth/issues/4495
function CustomPrismaAdapter(p: PrismaClient): Adapter {
  const origin = PrismaAdapter(p);
  return {
    ...origin,
    deleteSession: async (sessionToken: string) => {
      try {
        return await p.session.deleteMany({ where: { sessionToken } });
      } catch (e) {
        console.error('Failed to delete session', e);
        return null;
      }
    },
    // Override createUser to allow for anonymous users
    createUser: async (user) => {
      // Handle anonymous users without email
      return await p.user.create({
        data: {
          ...user,
          email: user.email || null, // Allow null emails
        },
      });
    },
  } as unknown as Adapter;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: CustomPrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: '/login',
    // Add custom error page if needed
    error: '/auth/error',
  },
  providers: [
    // Keep existing providers for transitional period
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Nodemailer({
      server: process.env.AZURE_EMAIL_CONNECTION_STRING!,
      sendVerificationRequest: async ({ identifier: email, url }) => {
        await sendEmail(email, 'Verify your email', url);
      },
    }),
    // Add credentials provider for password-based auth
    CredentialsProvider({
      name: "Password",
      credentials: {
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.password) return null;

        // Find user by password hash
        const user = await prisma.user.findFirst({
          where: {
            passwordHash: {
              not: null
            }
          }
        });

        // Verify password
        if (user?.passwordHash) {
          const isValid = await bcrypt.compare(
            credentials.password,
            user.passwordHash
          );

          if (isValid) {
            return {
              id: user.id,
              name: user.name,
              email: user.email
            };
          }
        }
        
        return null;
      }
    })
  ],
  callbacks: {
    // Add custom callbacks as needed
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    }
  }
});
