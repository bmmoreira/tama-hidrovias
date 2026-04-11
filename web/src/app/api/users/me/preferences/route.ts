import { NextRequest } from 'next/server';
import { proxyStrapiRequest } from '@/lib/strapi-server';

export async function GET(request: NextRequest) {
  return proxyStrapiRequest(request, '/api/users/me/preferences', {
    requireAuth: true,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();

  return proxyStrapiRequest(request, '/api/users/me/preferences', {
    method: 'PUT',
    requireAuth: true,
    body: JSON.stringify(body),
  });
}