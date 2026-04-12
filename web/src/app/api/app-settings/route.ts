import { NextRequest, NextResponse } from 'next/server';
import { canAccessAdmin } from '@/lib/roles';
import { getSessionRole, proxyStrapiRequest } from '@/lib/strapi-server';

export async function GET(request: NextRequest) {
  return proxyStrapiRequest(request, '/api/app-settings/public');
}

export async function PUT(request: NextRequest) {
  const role = await getSessionRole(request);

  if (!canAccessAdmin(role)) {
    return NextResponse.json(
      { error: 'Admin access required.' },
      { status: 403 },
    );
  }

  const body = await request.json();

  return proxyStrapiRequest(request, '/api/app-settings/current', {
    method: 'PUT',
    requireAuth: true,
    body: JSON.stringify(body),
  });
}