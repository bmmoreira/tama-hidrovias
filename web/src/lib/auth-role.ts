import { normalizeRole } from './roles';

export type StrapiRoleLike = {
  name?: string | null;
  type?: string | null;
};

export type StrapiMeLike = {
  role?: StrapiRoleLike | null;
};

export function resolveStrapiRole(me?: StrapiMeLike | null) {
  return normalizeRole(me?.role?.name) ?? normalizeRole(me?.role?.type) ?? 'authenticated';
}