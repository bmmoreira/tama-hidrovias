import { describe, it, expect } from 'vitest';
import { mercatorToLonLat, lonLatToTile } from './tiles';

describe('tiles utilities', () => {
  it('converts mercator origin to lon/lat', () => {
    const [lon, lat] = mercatorToLonLat(0, 0);
    expect(lon).toBeCloseTo(0, 6);
    expect(lat).toBeCloseTo(0, 6);
  });

  it('computes tile coordinates at zoom 1 for lon/lat 0,0', () => {
    const t = lonLatToTile(0, 0, 1);
    expect(t.z).toBe(1);
    expect(t.x).toBe(1);
    expect(t.y).toBe(1);
  });
});
