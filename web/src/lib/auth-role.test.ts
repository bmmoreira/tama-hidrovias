import { describe, expect, it } from 'vitest';

import { resolveStrapiRole } from './auth-role';

describe('resolveStrapiRole', () => {
  it('prefers the Strapi role name when present', () => {
    expect(
      resolveStrapiRole({
        role: {
          name: 'Analyst',
          type: 'authenticated',
        },
      })
    ).toBe('analyst');
  });

  it('falls back to the Strapi role type', () => {
    expect(
      resolveStrapiRole({
        role: {
          type: 'viewer',
        },
      })
    ).toBe('viewer');
  });

  it('returns authenticated when role is missing', () => {
    expect(resolveStrapiRole({})).toBe('authenticated');
    expect(resolveStrapiRole()).toBe('authenticated');
  });
});