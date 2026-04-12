import type { AppSettings, MapStylePreference, UserPreferences } from '@/lib/strapi';

export type MapViewState = {
  flyTarget: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  mapStyle: MapStylePreference;
};

export const MAPVIEW_DEFAULT_STATE: MapViewState = {
  flyTarget: {
    longitude: -52,
    latitude: -15,
    zoom: 4,
  },
  mapStyle: 'outdoors',
};

export function resolveMapViewState(
  preferencesMap?: UserPreferences['map'] | null,
  appSettingsMap?: AppSettings['map'] | null,
): MapViewState {
  const source = preferencesMap ?? appSettingsMap;

  if (!source) {
    return MAPVIEW_DEFAULT_STATE;
  }

  return {
    flyTarget: {
      longitude: source.centerLongitude,
      latitude: source.centerLatitude,
      zoom: source.defaultZoom,
    },
    mapStyle: source.mapStyle,
  };
}