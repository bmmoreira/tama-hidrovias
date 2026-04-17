import fs from 'fs/promises';
import path from 'path';
import Link from 'next/link';
import { fetchCogInfo } from '@/lib/titiler';
import { Card } from '@/components/ui/card';

export default async function TiffsPage({ searchParams }: any) {
  const page = Math.max(1, parseInt((searchParams?.page as string) ?? '1', 10) || 1);
  const pageSize = 10;
  const q = (searchParams?.q ?? '').toLowerCase();

  // Try several likely locations for the assets/tiff folder depending on where
  // Next's server process is running (container vs local dev). This improves
  // robustness when the working directory differs between environments.
  const candidates = [
    path.resolve(process.cwd(), 'assets/tiff'),
    path.resolve(process.cwd(), '../assets/tiff'),
    path.resolve(process.cwd(), '../../assets/tiff'),
  ];

  let files: string[] = [];
  let dir: string | null = null;
  for (const c of candidates) {
    try {
      const stat = await fs.stat(c);
      if (stat.isDirectory()) {
        files = await fs.readdir(c);
        dir = c;
        break;
      }
    } catch (e) {
      // try next
    }
  }

  // If no directory was found, default to the first candidate path (will error later when stat)
  if (!dir) dir = candidates[0];

  files = files.filter((f) => f.toLowerCase().endsWith('.tif') || f.toLowerCase().endsWith('.tiff'));
  if (q) files = files.filter((f) => f.toLowerCase().includes(q));

  const total = files.length;
  const start = (page - 1) * pageSize;
  const pageFiles = files.slice(start, start + pageSize);

  // Collect extra file metadata and COG info in parallel
  const infos = await Promise.all(
    pageFiles.map(async (name) => {
      const stat = await fs.stat(path.join(dir as string, name));
      const info = await fetchCogInfo(name);
      return {
        name,
        size: stat.size,
        mtime: stat.mtime.toISOString(),
        info,
      };
    }),
  );

  const totalPages = Math.ceil(total / pageSize) || 1;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">GeoTIFFs (assets/tiff)</h1>
        <div className="text-sm text-gray-500">{total} files</div>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4">
          <form className="mb-4" action="/dashboard/tiffs">
            <input defaultValue={searchParams?.q ?? ''} name="q" placeholder="filter by name" className="rounded border px-3 py-2" />
            <button className="ml-2 rounded bg-blue-600 px-3 py-2 text-white">Filter</button>
          </form>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 dark:border-slate-800 dark:bg-slate-900">
                <th className="px-4 py-3 text-left">File</th>
                <th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-left">Modified</th>
                <th className="px-4 py-3 text-left">CRS</th>
                <th className="px-4 py-3 text-left">Dimensions</th>
                <th className="px-4 py-3 text-left">Overviews</th>
                <th className="px-4 py-3 text-left">Bands</th>
                <th className="px-4 py-3 text-left">Data Type</th>
                <th className="px-4 py-3 text-left">NoData</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
              {infos.map((row) => (
                <tr key={row.name} className="hover:bg-gray-50 dark:hover:bg-slate-900/60">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/tiffs/${encodeURIComponent(row.name)}`} className="text-blue-600 underline">
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.size.toLocaleString()}</td>
                  <td className="px-4 py-3">{row.mtime}</td>
                  <td className="px-4 py-3">{row.info?.crs ?? '—'}</td>
                  <td className="px-4 py-3">{row.info ? `${row.info.width}×${row.info.height}` : '—'}</td>
                  <td className="px-4 py-3">{row.info?.overviews ? row.info.overviews.join(',') : '—'}</td>
                  <td className="px-4 py-3">{row.info?.bands ? (Array.isArray(row.info.bands) ? row.info.bands.map((b: any) => b.description || b.name || b).join(', ') : String(row.info.bands)) : '—'}</td>
                  <td className="px-4 py-3">{row.info?.data_type ?? '—'}</td>
                  <td className="px-4 py-3">{row.info?.nodata ?? '—'}</td>
                </tr>
              ))}
              {infos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-slate-500">No GeoTIFFs found in assets/tiff</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
          {page > 1 ? (
            <Link href={`/dashboard/tiffs?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="px-3 py-1 rounded border">Prev</Link>
          ) : null}
          {page < totalPages ? (
            <Link href={`/dashboard/tiffs?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ''}`} className="px-3 py-1 rounded border">Next</Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
