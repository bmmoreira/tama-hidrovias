import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Map, {
  Layer,
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
import StationDetailsModal from './StationDetailsModal';
import StationPopup, { type StationPopupData } from './StationPopup';
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

type PopupFeature = StationPopupData & {
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
  children?: ReactNode;
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

function parseFiniteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function parseFeatureExternalId(feature: MapGeoJSONFeature) {
  return parseFiniteNumber(feature.properties?.id);
}

function getStationMetadata(station: Station) {
  const metadata = station.attributes.metadata;

  return metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : {};
}

function buildPopupFeatureFromStation(
  station: Station,
  feature: MapGeoJSONFeature,
): PopupFeature | null {
  const featurePopup = toPopupFeature(feature);

  if (!featurePopup) {
    return null;
  }

  const metadata = getStationMetadata(station);

  return {
    name: featurePopup.name,
    code: station.attributes.code,
    source: station.attributes.source,
    satellite: featurePopup.satellite ?? parseString(metadata.satellite) ?? parseString(metadata.sat),
    river: station.attributes.river ?? featurePopup.river,
    basin: station.attributes.basin ?? featurePopup.basin,
    startDate: featurePopup.startDate ?? parseString(metadata.startDate),
    endDate: featurePopup.endDate ?? parseString(metadata.endDate),
    value: featurePopup.value ?? parseFiniteNumber(metadata.value),
    change: featurePopup.change ?? parseFiniteNumber(metadata.change),
    anomaly: featurePopup.anomaly ?? parseFiniteNumber(metadata.anomaly),
    longitude: station.attributes.longitude,
    latitude: station.attributes.latitude,
  };
}

function findMatchingStation(
  stations: Station[],
  feature: MapGeoJSONFeature,
) {
  const externalId = parseFeatureExternalId(feature);

  if (externalId === undefined) {
    return null;
  }

  return (
    stations.find((station) => station.attributes.externalId === externalId) ?? null
  );
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
    code: undefined,
    source: undefined,
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
  tileLayerUrl,
  children,
}: MapboxMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [popupFeature, setPopupFeature] = useState<PopupFeature | null>(null);
  const [detailFeature, setDetailFeature] = useState<PopupFeature | null>(null);

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

    const matchedStation = findMatchingStation(stations, clickedFeature);
    const nextPopupFeature = matchedStation
      ? buildPopupFeatureFromStation(matchedStation, clickedFeature)
      : toPopupFeature(clickedFeature);

    if (!nextPopupFeature) {
      return;
    }

    setDetailFeature(null);
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

        {popupFeature ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/40 p-4 backdrop-blur-sm dark:bg-slate-950/55 sm:p-6">
            <div className="pointer-events-auto">
              <StationPopup
                data={popupFeature}
                onClose={() => setPopupFeature(null)}
                onViewDetails={() => {
                  setDetailFeature(popupFeature);
                  setPopupFeature(null);
                }}
              />
            </div>
          </div>
        ) : null}
      </Map>

      <StationDetailsModal
        open={detailFeature !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailFeature(null);
          }
        }}
        data={detailFeature}
      />

      {children}
    </div>
  );
}

