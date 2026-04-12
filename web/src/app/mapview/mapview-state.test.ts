import { describe, expect, it } from 'vitest';
import { MAPVIEW_DEFAULT_STATE, resolveMapViewState } from './mapview-state';

describe('resolveMapViewState', () => {
  it('returns hardcoded defaults when neither preferences nor app settings are available', () => {
    expect(resolveMapViewState(undefined, undefined)).toEqual(MAPVIEW_DEFAULT_STATE);
  });

  it('uses guest app settings when user preferences are unavailable', () => {
    expect(
      resolveMapViewState(undefined, {
        mapStyle: 'streets',
        defaultZoom: 7,
        centerLatitude: -10,
        centerLongitude: -55,
      }),
    ).toEqual({
      mapStyle: 'streets',
      flyTarget: {
        longitude: -55,
        latitude: -10,
        zoom: 7,
      },
    });
  });

  it('prefers authenticated user preferences over guest app settings', () => {
    expect(
      resolveMapViewState(
        {
          mapStyle: 'dark',
          defaultZoom: 11,
          centerLatitude: -3.2,
          centerLongitude: -60.1,
        },
        {
          mapStyle: 'streets',
          defaultZoom: 7,
          centerLatitude: -10,
          centerLongitude: -55,
        },
      ),
    ).toEqual({
      mapStyle: 'dark',
      flyTarget: {
        longitude: -60.1,
        latitude: -3.2,
        zoom: 11,
      },
    });
  });
});