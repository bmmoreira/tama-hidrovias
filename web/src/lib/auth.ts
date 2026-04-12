import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { resolveStrapiRole } from '@/lib/auth-role';

const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://localhost:1337';

type StrapiAuthResponse = {
  jwt?: string;
  user?: {
    id: number;
    username?: string;
    email?: string;
  };
  error?: {
    message?: string;
  };
};

type StrapiMeResponse = {
  id: number;
  username?: string;
  email?: string;
  role?: {
    id: number;
    name?: string;
    type?: string;
  };
};

async function loginWithStrapi(email: string, password: string) {
  const response = await fetch(`${STRAPI_INTERNAL_URL}/api/auth/local`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      identifier: email,
      password,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as StrapiAuthResponse;
  if (!data.jwt || !data.user) {
    return null;
  }

  const meResponse = await fetch(`${STRAPI_INTERNAL_URL}/api/users/me?populate=role`, {
    headers: {
      Authorization: `Bearer ${data.jwt}`,
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!meResponse.ok) {
    return null;
  }

  const me = (await meResponse.json()) as StrapiMeResponse;

  return {
    id: String(me.id ?? data.user.id),
    name: me.username ?? data.user.username ?? data.user.email ?? email,
    email: me.email ?? data.user.email ?? email,
    role: resolveStrapiRole(me),
    strapiJwt: data.jwt,
  };
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        return loginWithStrapi(email, password);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.strapiJwt = user.strapiJwt;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? '');
        session.user.role = typeof token.role === 'string' ? token.role : undefined;
      }

      return session;
    },
  },
};
