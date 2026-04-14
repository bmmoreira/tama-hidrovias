import { NextRequest, NextResponse } from 'next/server';
import { isAnalystRole } from '@/lib/roles';
import { getSessionRole, proxyStrapiRequest } from '@/lib/strapi-server';

/** Route context with dynamic station id params for the API handlers. */
export type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

async function requireAnalyst(request: NextRequest) {
  const role = await getSessionRole(request);

  if (!isAnalystRole(role)) {
    return NextResponse.json(
      { error: 'Analyst role required.' },
      { status: 403 },
    );
  }

  return null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const unauthorizedResponse = await requireAnalyst(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { id } = await context.params;
  const body = await request.json();

  return proxyStrapiRequest(request, `/api/stations/${id}`, {
    method: 'PATCH',
    requireAuth: true,
    body: JSON.stringify({ data: body }),
  });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const unauthorizedResponse = await requireAnalyst(request);

  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { id } = await context.params;

  return proxyStrapiRequest(request, `/api/stations/${id}`, {
    method: 'DELETE',
    requireAuth: true,
  });
}