import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAnalystRole } from '@/lib/roles';
import fs from 'node:fs/promises';
import path from 'node:path';

const TILES_DIR = '/forecast-tiles';

// Deployments without direct access to the GeoTIFF volume (e.g. the google
// host, which runs the frontend separately from TiTiler's storage) proxy
// these requests to a deployment that does have local access, via a stable
// URL that isn't affected by where the main app hostname points.
const REMOTE_URL = process.env.FORECAST_TIFFS_API_URL;

async function proxyToRemote(suffix: string, init?: RequestInit) {
  const response = await fetch(`${REMOTE_URL}${suffix}`, { ...init, cache: 'no-store' });
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' },
  });
}

export async function GET() {
  if (REMOTE_URL) {
    return proxyToRemote('');
  }

  try {
    const entries = await fs.readdir(TILES_DIR, { withFileTypes: true });
    const directories = entries.filter((e) => e.isDirectory());
    
    const data = await Promise.all(
      directories.map(async (dir) => {
        const dirPath = path.join(TILES_DIR, dir.name);
        const files = await fs.readdir(dirPath, { withFileTypes: true });
        
        return {
          directory: dir.name,
          files: files
            .filter((f) => f.isFile() && f.name.endsWith('.tiff') || f.name.endsWith('.tif'))
            .map((f) => ({
              name: f.name,
              path: `${dir.name}/${f.name}`,
            })),
        };
      })
    );

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read forecast tiles directory' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!isAnalystRole(session?.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (REMOTE_URL) {
    const formData = await request.formData();
    return proxyToRemote('', { method: 'POST', body: formData });
  }

  try {
    const formData = await request.formData();
    const directory = formData.get('directory') as string;
    const file = formData.get('file') as File;

    if (!directory || !file) {
      return NextResponse.json({ error: 'Missing directory or file' }, { status: 400 });
    }

    // Validate directory name to prevent path traversal
    if (directory.includes('..') || directory.includes('/')) {
      return NextResponse.json({ error: 'Invalid directory name' }, { status: 400 });
    }

    const targetDir = path.join(TILES_DIR, directory);
    
    // Ensure the target directory exists
    try {
      await fs.access(targetDir);
    } catch {
      await fs.mkdir(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, file.name);
    
    // Convert File to Buffer and write
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetPath, buffer);

    return NextResponse.json({ success: true, path: `${directory}/${file.name}` });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!isAnalystRole(session?.user?.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  if (REMOTE_URL) {
    const { search } = new URL(request.url);
    return proxyToRemote(search, { method: 'DELETE' });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath || filePath.includes('..')) {
      return NextResponse.json({ error: 'Invalid file path' }, { status: 400 });
    }

    const targetPath = path.join(TILES_DIR, filePath);
    await fs.unlink(targetPath);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}