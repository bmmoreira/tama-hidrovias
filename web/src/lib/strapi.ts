/**
 * Core Strapi data access layer used by both server components and
 * client-side hooks.
 *
 * This module centralizes type definitions for Strapi entities
 * (stations, measurements, forecasts, app settings, user
 * preferences) and exposes small helper functions to talk to either
 * Strapi directly (on the server) or the internal Next.js API
 * routes (in the browser).
 */

/** Basic hydrometric station as exposed by Strapi. */
export type Station = {
  id: number;
  attributes: {
    name: string;
    code: string;
    externalId?: number;
    basin?: string;
    river?: string;
    source?: string;
    latitude: number;
    longitude: number;
    active?: boolean;
    [key: string]: unknown;
  };
};

/**
 * A climate layer record carrying information about a particular
 * geospatial GeoTIFF used for raster overlays on the map.
 */
export type ClimateLayer = {
  id: number;
  attributes: {
    title: string;
    variable: string;
    model?: string;
    period_start?: string;
    period_end?: string;
    geotiff?: { data?: { attributes: { name: string } } };
    [key: string]: unknown;
  };
};

/** Generic forecast payload returned from Strapi forecast endpoints. */
export type Forecast = {
  id: number;
  attributes: Record<string, any>;
};

/** Generic time series measurement record from Strapi. */
export type Measurement = {
  id: number;
  attributes: Record<string, any>;
};

/** Supported measurement variables for stations (levels, flows, etc.). */
export type StationVariable =
  | 'level_m'
  | 'flow_m3s'
  | 'precipitation_mm'
  | 'water_surface_elevation_m';

/** Allowed theme modes for the application shell. */
export type ThemePreference = 'light' | 'dark' | 'system';

/** Supported UI languages.
 *
 * Values follow BCP 47 language tags where applicable.
 */
export type LanguagePreference = 'pt-BR' | 'en' | 'es' | 'fr';

/** Available Mapbox base map styles. */
export type MapStylePreference = 'outdoors' | 'streets' | 'satellite' | 'dark';

/**
 * Visual configuration for the GeoJSON feature collection layer
 * rendered on the public map (circle radius, colors, etc.).
 */
export type FeatureCollectionLayerSettings = {
  circleRadius: number;
  positiveColor: string;
  negativeColor: string;
  strokeWidth: number;
  strokeColor: string;
  circleOpacity: number;
};

/** Default visual settings for the feature collection layer. */
export const DEFAULT_FEATURE_COLLECTION_LAYER_SETTINGS: FeatureCollectionLayerSettings = {
  circleRadius: 6,
  positiveColor: '#0284c7',
  negativeColor: '#ea580c',
  strokeWidth: 1.5,
  strokeColor: '#ffffff',
  circleOpacity: 0.9,
};

/** Severity threshold for alert notifications.
 *
 * Controls which alerts should be surfaced to the user in the UI.
 */
export type AlertSeverityPreference = 'info' | 'warning' | 'critical';

/** Snapshot of a station that has been marked as a favorite. */
export type FavoriteStationPreference = {
  id: number;
  name: string;
  code: string;
  basin?: string;
  source?: string;
};

/**
 * Optional personal profile information stored alongside user
 * preferences. This keeps basic contact and attribution details
 * close to the dashboard configuration without overloading the
 * authentication user model.
 */
export type UserProfilePreferences = {
  /** Optional avatar image associated with the profile. */
  avatar: {
    id: number;
    url: string;
    alternativeText?: string | null;
    width?: number | null;
    height?: number | null;
    mime?: string | null;
    size?: number | null;
  } | null;
  /** Given name used for dashboard personalization. */
  firstName: string | null;
  /** Family name or surname for the current user. */
  lastName: string | null;
  /** Institution or organization the user is associated with. */
  institution: string | null;
  /** Professional role or title for attribution. */
  profession: string | null;
  /**
   * Birthdate captured as an ISO ``YYYY-MM-DD`` string.
   *
   * Kept optional and string-typed so the UI can bind
   * directly to HTML ``<input type="date">`` controls
   * without additional parsing.
   */
  birthdate: string | null;
};

/**
 * Input shape for updating profile preferences. Avatar is optional here so
 * that most updates (for example, changing names or institution) do not need
 * to include it; the backend controller preserves the existing avatar when
 * the field is omitted.
 */
export type UserProfilePreferencesUpdateInput = Omit<
  UserProfilePreferences,
  'avatar'
> & {
  avatar?: UserProfilePreferences['avatar'];
};

/**
 * Full user preferences document as stored in Strapi for the
 * authenticated user.
 */
export type UserPreferences = {
  id: number;
  /** Optional personal details kept near preferences. */
  profile: UserProfilePreferences;
  appearance: {
    theme: ThemePreference;
    language: LanguagePreference;
    timeZone: string;
  };
  map: {
    mapStyle: MapStylePreference;
    defaultZoom: number;
    centerLatitude: number;
    centerLongitude: number;
  };
  alerts: {
    enabled: boolean;
    favoritesOnly: boolean;
    emailNotifications: boolean;
    dashboardNotifications: boolean;
    minimumSeverity: AlertSeverityPreference;
    leadTimeMinutes: number;
    dailyDigest: boolean;
    stationOfflineAlerts: boolean;
    forecastThresholdAlerts: boolean;
  };
  favoriteStations: FavoriteStationPreference[];
};

/**
 * Input payload for updating user preferences through the internal
 * Next.js route.
 */
export type UserPreferencesUpdateInput = {
  /** Optional personal details to persist with preferences. */
  profile?: UserProfilePreferencesUpdateInput;
  appearance: {
    theme: ThemePreference;
    language: LanguagePreference;
    timeZone: string;
  };
  map: {
    mapStyle: MapStylePreference;
    defaultZoom: number;
    centerLatitude: number;
    centerLongitude: number;
  };
  favoriteStationIds: number[];
  alerts?: {
    enabled: boolean;
    favoritesOnly: boolean;
    emailNotifications: boolean;
    dashboardNotifications: boolean;
    minimumSeverity: AlertSeverityPreference;
    leadTimeMinutes: number;
    dailyDigest: boolean;
    stationOfflineAlerts: boolean;
    forecastThresholdAlerts: boolean;
  };
};

/**
 * Global, admin-managed application settings that control defaults
 * for unauthenticated visitors and overall map behavior.
 */
export type AppSettings = {
  id: number;
  appearance: {
    language: LanguagePreference;
  };
  map: {
    mapStyle: MapStylePreference;
    defaultZoom: number;
    centerLatitude: number;
    centerLongitude: number;
  };
  featureCollectionLayer: FeatureCollectionLayerSettings;
};

/** Input payload for updating global AppSettings. */
export type AppSettingsUpdateInput = {
  appearance: {
    language: LanguagePreference;
  };
  map: {
    mapStyle: MapStylePreference;
    defaultZoom: number;
    centerLatitude: number;
    centerLongitude: number;
  };
  featureCollectionLayer: FeatureCollectionLayerSettings;
};

/** Minimal GeoJSON geometry representation used for feature collections. */
export type MapFeatureCollectionGeometry = {
  type: string;
  coordinates: unknown;
};

/** Single GeoJSON feature inside a feature collection. */
export type MapFeatureCollectionFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: MapFeatureCollectionGeometry;
};

/** GeoJSON FeatureCollection used to render the public map overlay. */
export type MapFeatureCollection = {
  type: 'FeatureCollection';
  name?: string;
  crs?: {
    type: string;
    properties: {
      name: string;
    };
  };
  features: MapFeatureCollectionFeature[];
};

/**
 * Strapi record for the single map feature collection entry used by
 * the public map and dashboard.
 */
export type MapFeatureCollectionRecord = {
  id: number;
  name: string;
  featureCollection: MapFeatureCollection;
};

/** Input payload for creating or updating a station from the UI. */
export type StationMutationInput = {
  name: string;
  code: string;
  externalId?: number;
  source: 'ANA' | 'HydroWeb' | 'SNIRH' | 'Virtual';
  latitude: number;
  longitude: number;
  basin?: string;
  river?: string;
  active?: boolean;
  altitude_m?: number;
};

const STRAPI_INTERNAL_URL =
  process.env.STRAPI_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_STRAPI_URL ??
  'http://localhost:1337';

// The shared data layer is intentionally split between two environments:
// server-side code can call Strapi directly, while browser code must stay on
// internal Next.js API routes so the Strapi JWT never reaches the client.
function isServer() {
  return typeof window === 'undefined';
}

// Resolve the correct base depending on where this helper is executing.
function withBase(path: string) {
  return isServer() ? `${STRAPI_INTERNAL_URL}${path}` : path;
}

// Central JSON fetcher used by all resource helpers. It normalizes the Accept
// header, disables stale caching by default, and turns Strapi-style error
// payloads into thrown JavaScript errors for the UI.
async function fetchJson(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
    cache: options.cache ?? 'no-store',
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      payload?.message ??
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

// Stations are served through the internal `/api/stations` route in the browser
// and can be called directly from the server during SSR or route handling.
function buildStationsPath(params?: Record<string, string>) {
  const query = new URLSearchParams(params);

  if (!query.has('pagination[pageSize]')) {
    query.set('pagination[pageSize]', '500');
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return `/api/stations${suffix}`;
}

function buildStationMutationPath(stationId: number) {
  return `/api/stations/${stationId}`;
}

function buildMeasurementsPath(
  stationId?: number,
  variable?: string,
  from?: string,
  to?: string,
) {
  // Measurements are always requested through filtered query strings because
  // charts and tables in the dashboard work off time windows and a selected
  // variable.
  const query = new URLSearchParams();

  if (stationId) {
    query.set('filters[station][id][$eq]', String(stationId));
  }
  if (variable) {
    query.set('filters[variable][$eq]', variable);
  }
  if (from) {
    query.set('filters[datetime][$gte]', from);
  }
  if (to) {
    query.set('filters[datetime][$lte]', to);
  }

  query.set('sort[0]', 'datetime:asc');
  query.set('pagination[pageSize]', '1000');

  return `/api/measurements?${query.toString()}`;
}

function buildForecastsPath(stationId?: number, variable?: string) {
  // Forecast requests are sorted by issue date first and valid date second so
  // the UI can group the freshest forecast runs without re-sorting client-side.
  const query = new URLSearchParams();

  if (stationId) {
    query.set('filters[station][id][$eq]', String(stationId));
  }
  if (variable) {
    query.set('filters[variable][$eq]', variable);
  }

  query.set('sort[0]', 'issued_at:desc');
  query.set('sort[1]', 'valid_at:asc');
  query.set('pagination[pageSize]', '1000');

  return `/api/forecasts?${query.toString()}`;
}

function buildClimateLayersPath() {
  // Climate layers only need the GeoTIFF file name for tile composition, so the
  // populate clause is intentionally narrow to keep responses smaller.
  const query = new URLSearchParams();
  query.set('populate[geotiff][fields][0]', 'name');
  query.set('sort[0]', 'period_start:desc');
  query.set('pagination[pageSize]', '200');
  return `/api/climate-layers?${query.toString()}`;
}

function buildUserPreferencesPath() {
  return '/api/users/me/preferences';
}

function buildAppSettingsPath() {
  return '/api/app-settings';
}

function buildMapFeatureCollectionPath() {
  return '/api/map-feature-collections';
}

export async function getStations(params?: Record<string, string>) {
  const path = buildStationsPath(params);
  return fetchJson(withBase(path));
}

export async function getClimateLayers() {
  const path = buildClimateLayersPath();
  return fetchJson(withBase(path));
}

export async function getForecasts(stationId?: number, variable?: string) {
  const path = buildForecastsPath(stationId, variable);
  return fetchJson(withBase(path));
}

export async function getMeasurements(
  stationId?: number,
  variable?: string,
  from?: string,
  to?: string,
) {
  const path = buildMeasurementsPath(stationId, variable, from, to);
  return fetchJson(withBase(path));
}

export async function createVirtualStation(body: Record<string, unknown>) {
  // Browser writes go to internal API routes, not directly to Strapi, so the
  // server can enforce role checks and attach the server-side Strapi JWT.
  return fetchJson('/api/stations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function updateStation(
  stationId: number,
  body: StationMutationInput,
) {
  return fetchJson(withBase(buildStationMutationPath(stationId)), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function deleteStation(stationId: number) {
  return fetchJson(withBase(buildStationMutationPath(stationId)), {
    method: 'DELETE',
  });
}

export async function getUserPreferences(): Promise<{ data: UserPreferences }> {
  return fetchJson(withBase(buildUserPreferencesPath()));
}

export async function updateUserPreferences(body: UserPreferencesUpdateInput) {
  return fetchJson(withBase(buildUserPreferencesPath()), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function getAppSettings(): Promise<{ data: AppSettings }> {
  const path = buildAppSettingsPath();

  if (isServer()) {
    return fetchJson(`${STRAPI_INTERNAL_URL}/api/app-settings/public`);
  }

  return fetchJson(path);
}

export async function getMapFeatureCollection(): Promise<{
  data: MapFeatureCollectionRecord;
}> {
  const path = buildMapFeatureCollectionPath();

  if (isServer()) {
    return fetchJson(`${STRAPI_INTERNAL_URL}/api/map-feature-collections/public`);
  }

  return fetchJson(path);
}

export async function updateAppSettings(body: AppSettingsUpdateInput) {
  return fetchJson(buildAppSettingsPath(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
