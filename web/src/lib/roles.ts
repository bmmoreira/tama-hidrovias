const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  analyst: 'Analyst',
  authenticated: 'Authenticated',
  'super-admin': 'Super Admin',
  viewer: 'Viewer',
};

export function normalizeRole(value?: string | null) {
  return value
    ?.trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function getRoleLabel(value?: string | null) {
  const normalizedRole = normalizeRole(value);

  if (!normalizedRole) {
    return ROLE_LABELS.authenticated;
  }

  return ROLE_LABELS[normalizedRole] ?? value?.trim() ?? ROLE_LABELS.authenticated;
}

export function isViewerRole(value?: string | null) {
  return normalizeRole(value) === 'viewer';
}

export function isAnalystRole(value?: string | null) {
  return normalizeRole(value) === 'analyst';
}

export function canAccessAdmin(value?: string | null) {
  const normalizedRole = normalizeRole(value);

  return (
    normalizedRole === 'admin' ||
    normalizedRole === 'analyst' ||
    normalizedRole === 'super-admin'
  );
}