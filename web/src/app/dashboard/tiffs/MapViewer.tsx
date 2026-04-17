"use client";
import React from 'react';
import MapBase from '@/components/maps/MapBase';

export default function MapViewer({ tileUrl, center, fitBounds, minZoom, maxZoom }: { tileUrl: string; center?: [number, number]; fitBounds?: [number, number, number, number]; minZoom?: number; maxZoom?: number }) {
  return (
    <div className="h-[560px]">
      <MapBase
        initialViewState={center ? { longitude: center[0], latitude: center[1], zoom: 6 } : undefined}
        tileLayerUrl={tileUrl}
        fitBounds={fitBounds}
        minZoom={minZoom}
        maxZoom={maxZoom}
      />
    </div>
  );
}
