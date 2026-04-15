import { NextRequest, NextResponse } from 'next/server';
import { getStrapiAccessToken } from '@/lib/strapi-server';

const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://localhost:1337';

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export async function POST(request: NextRequest) {
  const accessToken = await getStrapiAccessToken(request);

  if (!accessToken) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  // In the Node.js runtime, the global File constructor is not always defined,
  // so we avoid relying on `instanceof File` here. Instead, we treat the
  // value as a Blob-like object and perform a minimal shape check.
  if (!file || typeof (file as any).arrayBuffer !== 'function') {
    return NextResponse.json({ error: 'Missing avatar file.' }, { status: 400 });
  }

  const uploadFile = file as any;

  if (!ALLOWED_MIME_TYPES.has(uploadFile.type)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
  }

  if (uploadFile.size > MAX_AVATAR_SIZE_BYTES) {
    return NextResponse.json({ error: 'Avatar is too large (max 5MB).' }, { status: 400 });
  }

  // Upload the file to Strapi using the Upload plugin
  const uploadForm = new FormData();
  uploadForm.append('files', uploadFile);

  const uploadResponse = await fetch(`${STRAPI_INTERNAL_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: uploadForm,
    cache: 'no-store',
  });

  if (!uploadResponse.ok) {
    const errorPayload = await uploadResponse.json().catch(() => null);
    return NextResponse.json(
      {
        error:
          errorPayload?.error?.message ??
          errorPayload?.message ??
          'Failed to upload avatar.',
      },
      { status: uploadResponse.status },
    );
  }

  const uploaded = await uploadResponse.json();
  const uploadedFile = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  const fileId = uploadedFile?.id;

  if (!fileId || typeof fileId !== 'number') {
    return NextResponse.json(
      { error: 'Unexpected upload response from Strapi.' },
      { status: 500 },
    );
  }

  // Attach the uploaded file as the current user's profile avatar by updating
  // the user-preference document through the existing `updateMe` controller.
  const preferenceResponse = await fetch(
    `${STRAPI_INTERNAL_URL}/api/users/me/preferences`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        profile: {
          avatar: fileId,
        },
      }),
      cache: 'no-store',
    },
  );

  const preferencePayload = await preferenceResponse.json().catch(() => null);

  if (!preferenceResponse.ok) {
    return NextResponse.json(
      {
        error:
          preferencePayload?.error?.message ??
          preferencePayload?.message ??
          'Failed to update avatar preferences.',
      },
      { status: preferenceResponse.status },
    );
  }

  return NextResponse.json(preferencePayload, { status: 200 });
}
