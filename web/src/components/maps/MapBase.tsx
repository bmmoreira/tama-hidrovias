import { useEffect, useMemo, useRef, useState } from 'react';
import Map, {
  Layer,
  Popup,
  Marker,
  type MapLayerMouseEvent,
  NavigationControl,
  ScaleControl,
  Source,
  type LayerProps,
  type MapGeoJSONFeature,
  type MapRef,
} from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  DEFAULT_FEATURE_COLLECTION_LAYER_SETTINGS,
  type FeatureCollectionLayerSettings,
} from '@/lib/strapi';
import type {
  MapStylePreference,
  MapFeatureCollection,
  Station,
} from '@/lib/strapi';


export interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
}

type PopupStation = {
  id: number;
  name: string;
  code: string;
  source?: string;
  basin?: string;
  longitude: number;
  latitude: number;
};

type PopupFeature = {
  name: string;
  satellite?: string;
  river?: string;
  basin?: string;
  startDate?: string;
  endDate?: string;
  value?: number;
  change?: number;
  anomaly?: number;
  longitude: number;
  latitude: number;
};

interface MapboxMapProps {
  initialViewState?: ViewState;
  mapStyle?: MapStylePreference;
  stations?: Station[];
  featureCollection?: MapFeatureCollection;
  featureCollectionLayerStyle?: FeatureCollectionLayerSettings;
  onStationDoubleClick?: (station: Station) => void;
  tileLayerUrl?: string;
}

const MAPBOX_STYLE_URLS: Record<MapStylePreference, string> = {
  outdoors: 'mapbox://styles/mapbox/outdoors-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

const TILE_LAYER_STYLE = {
  id: 'mapview-raster-layer',
  type: 'raster',
  paint: {
    'raster-opacity': 0.7,
  },
} as const;

const FEATURE_COLLECTION_LAYER_ID = 'mapview-feature-collection-layer';

function buildFeatureCollectionLayer(
  style: FeatureCollectionLayerSettings,
): LayerProps {
  return {
    id: FEATURE_COLLECTION_LAYER_ID,
    type: 'circle',
    paint: {
      'circle-radius': style.circleRadius,
      'circle-color': [
        'case',
        ['>=', ['coalesce', ['get', 'anomalia'], 0], 0],
        style.positiveColor,
        style.negativeColor,
      ],
      'circle-stroke-width': style.strokeWidth,
      'circle-stroke-color': style.strokeColor,
      'circle-opacity': style.circleOpacity,
    },
  };
}

function getStationColor(source?: string) {
  switch (source) {
    case 'ANA':
      return '#2563eb';
    case 'HydroWeb':
      return '#16a34a';
    case 'SNIRH':
      return '#d97706';
    case 'Virtual':
      return '#9333ea';
    default:
      return '#6b7280';
  }
}

function parseFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toPopupFeature(feature: MapGeoJSONFeature): PopupFeature | null {
  if (feature.geometry.type !== 'Point') {
    return null;
  }

  const coordinates = feature.geometry.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return null;
  }

  const [longitude, latitude] = coordinates;

  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return null;
  }

  const properties = feature.properties ?? {};

  return {
    name: typeof properties.name === 'string' ? properties.name : 'Feature',
    satellite:
      typeof properties.sat === 'string'
        ? properties.sat
        : typeof properties.satellite === 'string'
          ? properties.satellite
          : undefined,
    river: typeof properties.river === 'string' ? properties.river : undefined,
    basin: typeof properties.basin === 'string' ? properties.basin : undefined,
    startDate: typeof properties.s_date === 'string' ? properties.s_date : undefined,
    endDate: typeof properties.e_date === 'string' ? properties.e_date : undefined,
    value: parseFiniteNumber(properties.value),
    change: parseFiniteNumber(properties.change),
    anomaly: parseFiniteNumber(properties.anomalia),
    longitude,
    latitude,
  };
}

export default function MainMap({
  initialViewState = { longitude: -52, latitude: -15, zoom: 4 },
  mapStyle = 'outdoors',
  stations = [],
  featureCollection,
  featureCollectionLayerStyle,
  onStationDoubleClick,
  tileLayerUrl,
}: MapboxMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [popupStation, setPopupStation] = useState<PopupStation | null>(null);
  const [popupFeature, setPopupFeature] = useState<PopupFeature | null>(null);

  const mapStyleUrl = useMemo(
    () => MAPBOX_STYLE_URLS[mapStyle] ?? MAPBOX_STYLE_URLS.outdoors,
    [mapStyle],
  );
  const featureCollectionLayer = useMemo(
    () =>
      buildFeatureCollectionLayer(
        featureCollectionLayerStyle ?? DEFAULT_FEATURE_COLLECTION_LAYER_SETTINGS,
      ),
    [featureCollectionLayerStyle],
  );

  useEffect(() => {
    mapRef.current?.flyTo({
      center: [initialViewState.longitude, initialViewState.latitude],
      zoom: initialViewState.zoom,
      duration: 1200,
    });
  }, [initialViewState]);

  const handleFeatureClick = (event: MapLayerMouseEvent) => {
    const clickedFeature = event.features?.find(
      (feature) => feature.layer?.id === FEATURE_COLLECTION_LAYER_ID,
    );

    if (!clickedFeature) {
      return;
    }

    const nextPopupFeature = toPopupFeature(clickedFeature);

    if (!nextPopupFeature) {
      return;
    }

    setPopupStation(null);
    setPopupFeature(nextPopupFeature);
  };

  return (
    <div className="relative h-full w-full">
      <Map
        ref={mapRef}
        initialViewState={initialViewState}
        mapStyle={mapStyleUrl}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        attributionControl
        interactiveLayerIds={featureCollection ? [FEATURE_COLLECTION_LAYER_ID] : undefined}
        onClick={handleFeatureClick}
        reuseMaps
      >
        <NavigationControl position="top-right" />
        <ScaleControl position="bottom-right" unit="metric" />

        {tileLayerUrl ? (
          <Source id="mapview-raster-source" type="raster" tiles={[tileLayerUrl]} tileSize={256}>
            <Layer {...TILE_LAYER_STYLE} />
          </Source>
        ) : null}

        {featureCollection ? (
          <Source
            id="mapview-feature-collection-source"
            type="geojson"
            data={featureCollection}
          >
            <Layer {...featureCollectionLayer} />
          </Source>
        ) : null}

        {stations.map((station) => {
          const color = getStationColor(station.attributes.source);

          return (
            <Marker
              key={station.id}
              longitude={station.attributes.longitude}
              latitude={station.attributes.latitude}
              anchor="center"
            >
              <button
                type="button"
                aria-label={station.attributes.name}
                className="h-4 w-4 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: color }}
                onClick={() => {
                  setPopupFeature(null);
                  setPopupStation({
                    id: station.id,
                    name: station.attributes.name,
                    code: station.attributes.code,
                    source: station.attributes.source,
                    basin: station.attributes.basin,
                    longitude: station.attributes.longitude,
                    latitude: station.attributes.latitude,
                  });
                }}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onStationDoubleClick?.(station);
                }}
              />
            </Marker>
          );
        })}

        {popupStation ? (
          <Popup
            anchor="top"
            longitude={popupStation.longitude}
            latitude={popupStation.latitude}
            offset={12}
            onClose={() => setPopupStation(null)}
            closeOnClick={false}
          >
            <div className="p-1 text-sm">
              <strong className="block text-gray-900">{popupStation.name}</strong>
              <span className="text-gray-500">
                {popupStation.code}
                {popupStation.source ? ` · ${popupStation.source}` : ''}
              </span>
              {popupStation.basin ? (
                <p className="text-gray-500">Bacia: {popupStation.basin}</p>
              ) : null}
            </div>
          </Popup>
        ) : null}

        {popupFeature ? (
          <Popup
            anchor="top"
            longitude={popupFeature.longitude}
            latitude={popupFeature.latitude}
            offset={12}
            onClose={() => setPopupFeature(null)}
            closeOnClick={false}
          >
            <div className="min-w-44 p-1 text-sm">
              <strong className="block text-gray-900">{popupFeature.name}</strong>
              {popupFeature.satellite ? (
                <p className="text-gray-500">Sat: {popupFeature.satellite}</p>
              ) : null}
              {popupFeature.river ? (
                <p className="text-gray-500">Rio: {popupFeature.river}</p>
              ) : null}
              {popupFeature.basin ? (
                <p className="text-gray-500">Bacia: {popupFeature.basin}</p>
              ) : null}
              {popupFeature.value !== undefined ? (
                <p className="text-gray-500">Valor: {popupFeature.value}</p>
              ) : null}
              {popupFeature.change !== undefined ? (
                <p className="text-gray-500">Variação: {popupFeature.change}</p>
              ) : null}
              {popupFeature.anomaly !== undefined ? (
                <p className="text-gray-500">Anomalia: {popupFeature.anomaly}</p>
              ) : null}
              {popupFeature.startDate || popupFeature.endDate ? (
                <p className="text-gray-500">
                  {popupFeature.startDate ?? '...'}
                  {' -> '}
                  {popupFeature.endDate ?? '...'}
                </p>
              ) : null}
            </div>
          </Popup>
        ) : null}
      </Map>
    </div>
  );
}

