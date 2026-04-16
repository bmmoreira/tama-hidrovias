TiTiler proxy route

This `README` describes the purpose and behavior of the catch-all proxy route implemented in `route.ts`.

Location
- `web/src/app/api/titiler/[...path]/route.ts`

Behaviour summary
- Forwards client requests under `/api/titiler/*` to the internal TiTiler service configured by `TITILER_INTERNAL_URL`.
- Injects `TITILER_INTERNAL_TOKEN` as `Authorization: Bearer <token>` and as `access_token` query parameter when needed.
- Whitelists safe request headers and avoids forwarding `content-length`.
- Sanitizes response headers; forwards only safe ones (`content-type`, `cache-control`, `expires`, `etag`, `last-modified`, `x-titiler-cache-status`).
- Mirrors `Origin` in `Access-Control-Allow-Origin` to support browser clients.
- Normalizes path segments to prevent duplicate `/map/map/...` forwards.

Tips for consuming pages/components
- Server components should call helper functions in `web/src/lib/titiler.ts` to fetch metadata and build tile URLs.
- Client components should request `/api/titiler/...` (the proxy) rather than TiTiler directly.

Environment variables
- `TITILER_INTERNAL_URL` — base URL for TiTiler (default: `http://hfs-titiler:8000`).
- `TITILER_INTERNAL_TOKEN` — optional token injected server-side.
- `LOG_LEVEL` — logging level used by pino.

Logging
- Look for `titiler-proxy.forward` debug events in `web` logs for sanitized proxied request records.

Troubleshooting
- If you see `ERR_CONTENT_LENGTH_MISMATCH` in the browser, ensure the proxy code still strips `content-length` on responses.
- If you see `/map/map/...` 404s in TiTiler logs, the proxy applies normalization to avoid this; verify the deployed code matches repository.

