'use client';

import { useMemo } from 'react';
import useSWR from 'swr';
import { Ship } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CrossSectionFeature } from './crossSectionClusterLayer';

export interface CrossSectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: CrossSectionFeature | null;
}

interface ProfilePoint {
  /** Distance along the section, in meters. */
  distance: number;
  /** Depth at this point, in meters (positive = deeper). */
  depth: number | null;
}

/**
 * Parses a `secoes_transversais/*.txt` profile: two tab-separated columns,
 * no header -- distance (m), depth (m). "nan" rows (NoData pixels, see
 * `assets/secoes_transversais/LEIA_ME.txt`) become a gap in the chart
 * rather than a false zero.
 */
function parseProfile(text: string): ProfilePoint[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [distanceStr, depthStr] = line.split('\t');
      const distance = Number(distanceStr);
      const depth = Number(depthStr);
      return {
        distance,
        depth: Number.isFinite(depth) ? depth : null,
      };
    })
    .filter((point) => Number.isFinite(point.distance));
}

async function fetchProfile(url: string): Promise<ProfilePoint[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load profile: ${response.status}`);
  return parseProfile(await response.text());
}

function formatMeters(value: number | undefined, digits = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)} m` : '...';
}

/**
 * Modal showing a river cross-section (transversal section) profile for a
 * `crossSectionClusterLayer` point: distance across the section vs. depth,
 * loaded lazily from its `secoes_transversais/<file>` profile on open.
 * Mirrors `StationDetailsModal`'s Dialog/Card structure, but for this
 * static geometric profile rather than a time series.
 */
export default function CrossSectionModal({ open, onOpenChange, feature }: CrossSectionModalProps) {
  const file = feature?.properties.file;

  const { data: profile, isLoading } = useSWR(
    open && file ? `/geojson/secoes_transversais/${file}` : null,
    fetchProfile,
    { revalidateOnFocus: false },
  );

  const chartData = useMemo(() => profile ?? [], [profile]);

  const stats = useMemo(() => {
    const depths = chartData.map((p) => p.depth).filter((d): d is number => d !== null);
    if (depths.length === 0) return null;
    return {
      maxDepth: Math.max(...depths),
      meanDepth: depths.reduce((sum, d) => sum + d, 0) / depths.length,
      width: chartData[chartData.length - 1]?.distance ?? undefined,
    };
  }, [chartData]);

  const props = feature?.properties;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-[1.75rem] border border-gray-200 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:w-[calc(100%-2rem)]">
        {props ? (
          <div className="flex flex-col">
            <DialogHeader className="border-b border-gray-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 px-4 py-5 dark:border-slate-800 dark:from-amber-950/30 dark:via-slate-950 dark:to-orange-950/10 sm:px-6 sm:py-6">
              <DialogTitle className="pr-12 text-lg font-semibold text-slate-900 dark:text-slate-100 sm:text-2xl">
                Seção transversal · nó {props.sword_node_id}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
                Perfil de profundidade medido ao longo da seção do rio neste ponto (dados derivados do SWORD).
              </DialogDescription>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                  FID: {props.fid}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                  Reach SWORD: {props.sword_reach_id}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                  Largura (SWORD): {formatMeters(props.sword_width, 0)}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 dark:border-slate-700 dark:bg-slate-900/80">
                  Distância da foz: {(props.sword_dist_out / 1000).toFixed(1)} km
                </span>
              </div>
            </DialogHeader>

            <div className="space-y-4 px-4 py-4 sm:px-6 sm:py-6">
              {stats && (
                <section className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                      Profundidade máxima
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatMeters(stats.maxDepth)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                      Profundidade média
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatMeters(stats.meanDepth)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
                    <div className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">
                      Largura medida
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {formatMeters(stats.width, 0)}
                    </div>
                  </div>
                </section>
              )}

              <Card className="overflow-hidden border-gray-200/80 bg-white/90 shadow-sm dark:border-slate-800 dark:bg-slate-950/90">
                <CardHeader className="pb-2">
                  <CardTitle>Perfil da seção (distância × profundidade)</CardTitle>
                </CardHeader>
                <CardContent>
                  <style>{`
                    @keyframes cross-section-ship-bob {
                      0%, 100% { transform: translateY(0) rotate(-3deg); }
                      50%       { transform: translateY(-4px) rotate(3deg); }
                    }
                    .cross-section-ship-bob {
                      animation: cross-section-ship-bob 3.2s ease-in-out infinite;
                      transform-box: fill-box;
                      transform-origin: center;
                    }
                  `}</style>
                  <div className="relative h-72 w-full sm:h-80">
                    {isLoading ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-200 border-t-amber-600" />
                      </div>
                    ) : chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                          <defs>
                            <linearGradient id="crossSectionFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.08} />
                              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.55} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                          <XAxis
                            dataKey="distance"
                            type="number"
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickFormatter={(value: number) => `${value.toFixed(0)} m`}
                            label={{ value: 'Distância (m)', position: 'insideBottom', offset: -2, fontSize: 11, fill: '#94a3b8' }}
                          />
                          <YAxis
                            reversed
                            domain={[0, 'auto']}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickFormatter={(value: number) => `${value.toFixed(0)} m`}
                            label={{ value: 'Profundidade (m)', angle: -90, position: 'insideLeft', fontSize: 11, fill: '#94a3b8' }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: 16, borderColor: '#cbd5e1' }}
                            formatter={(value: number) => [`${value.toFixed(2)} m`, 'Profundidade']}
                            labelFormatter={(value: number) => `Distância: ${value.toFixed(1)} m`}
                          />
                          <Area
                            type="monotone"
                            dataKey="depth"
                            stroke="#b45309"
                            fill="url(#crossSectionFill)"
                            strokeWidth={2}
                            connectNulls={false}
                          />
                          {/* Water surface (depth 0) -- dashed reference line at
                              the exact computed pixel for y=0, with the same
                              boat icon/bobbing animation as the welcome screen
                              anchored to it via the label renderer, so it's
                              always exactly on the line regardless of the
                              section's own min/max depth. */}
                          <ReferenceLine
                            y={0}
                            stroke="#0284c7"
                            strokeDasharray="6 4"
                            strokeWidth={1.5}
                            label={(props: { viewBox?: { x: number; y: number; width: number } }) => {
                              const viewBox = props.viewBox;
                              if (!viewBox) return <g />;
                              const cx = viewBox.x + viewBox.width / 2;
                              const cy = viewBox.y;
                              return (
                                <g transform={`translate(${cx}, ${cy})`}>
                                  {/* Anchored by its bottom edge, not its center,
                                      so the hull rests on the line instead of
                                      being bisected by it -- the bob animation
                                      only ever lifts it further up from here,
                                      never pushes it below the water line. */}
                                  <g className="cross-section-ship-bob" transform="translate(-18, -36)">
                                    <Ship width={36} height={36} color="#0284c7" strokeWidth={1.75} />
                                  </g>
                                </g>
                              );
                            }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                        Sem dados de perfil disponíveis para esta seção.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
