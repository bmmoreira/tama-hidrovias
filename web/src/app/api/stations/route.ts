import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAnalystRole } from '@/lib/roles';
import { getSessionRole, proxyStrapiRequest } from '@/lib/strapi-server';

export async function GET(request: NextRequest) {
  return proxyStrapiRequest(request, '/api/stations');
}

export async function POST(request: NextRequest) {
  const role = await getSessionRole(request);

  if (!isAnalystRole(role)) {
    return NextResponse.json(
      { error: 'Analyst role required.' },
      { status: 403 },
    );
  }

  const body = await request.json();

  return proxyStrapiRequest(request, '/api/stations', {
    method: 'POST',
    requireAuth: true,
    body: JSON.stringify({ data: body }),
  });
}
