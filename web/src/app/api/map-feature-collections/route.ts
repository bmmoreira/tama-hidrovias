import { NextRequest } from 'next/server';
import { proxyStrapiRequest } from '@/lib/strapi-server';

export async function GET(request: NextRequest) {
  return proxyStrapiRequest(request, '/api/map-feature-collections/public');
}