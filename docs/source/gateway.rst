Gateway Topology and Service URLs
=================================

Overview
--------

The Tama Hidrovias stack is designed to run behind a small Nginx "gateway"
that fronts all core services. This makes it easy to move between local
development and production by changing DNS and a small set of environment
variables, without touching application code.

At a high level, there are four browser-visible entrypoints:

- ``app.*`` for the Next.js frontend
- ``db.*`` for the Strapi CMS and API
- ``assets.*`` for static assets and public uploads
- ``tiles.*`` for raster tiles served by TileServer GL

In local development, these are typically:

- ``http://app.local``
- ``http://db.local``
- ``http://assets.local``
- ``http://tiles.local``

mapped in ``/etc/hosts`` to ``127.0.0.1``.

In production, the same pattern can be applied to a real domain:

- ``https://app.example.com``
- ``https://db.example.com``
- ``https://assets.example.com``
- ``https://tiles.example.com``

The Nginx container in ``docker-compose.yml`` acts as the single gateway for
all of these hostnames.

Service Routing
---------------

The Nginx configuration in ``nginx/nginx.conf`` defines three upstreams on the
internal Docker network:

- ``web_app`` → ``web:3000`` (Next.js application)
- ``strapi_cms`` → ``strapi:1337`` (Strapi CMS)
- ``tileserver_backend`` → ``tileserver:8080`` (TileServer GL)

and four server blocks for the browser-visible hosts:

- ``server_name app.local app.*`` routes ``/`` to ``web_app``
- ``server_name db.local db.*`` routes ``/`` to ``strapi_cms``
- ``server_name assets.local assets.*`` serves ``/`` from ``/srv/assets/`` and
  ``/uploads/`` from ``/srv/strapi-uploads/``
- ``server_name tiles.local tiles.*`` routes ``/`` to ``tileserver_backend``

Static assets and Strapi uploads are mounted into the Nginx container via
volumes in ``docker-compose.yml``:

- ``./assets`` → ``/srv/assets``
- ``./cms/public/uploads`` → ``/srv/strapi-uploads``

Environment Variables
---------------------

The following environment variables control how the web application and
supporting services talk to each other:

Frontend (browser-facing)
~~~~~~~~~~~~~~~~~~~~~~~~~

- ``NEXT_PUBLIC_STRAPI_URL``

  Base URL that browser code uses when it needs to reference Strapi directly
  (for example, absolute media URLs). In development this is typically::

      NEXT_PUBLIC_STRAPI_URL=http://db.local

- ``NEXT_PUBLIC_TILESERVER_URL``

  Base URL for raster tiles, used when building tile URLs in the map views.
  In development::

      NEXT_PUBLIC_TILESERVER_URL=http://tiles.local

- ``NEXTAUTH_URL``

  External URL of the Next.js application, used by NextAuth for callbacks.
  In development::

      NEXTAUTH_URL=http://app.local

Server-side (internal)
~~~~~~~~~~~~~~~~~~~~~~

- ``STRAPI_INTERNAL_URL``

  Internal-only base URL used by server-side helpers in ``web/`` (for example
  in ``web/src/lib/strapi.ts`` and ``web/src/lib/auth.ts``). This typically
  points directly at the ``strapi`` service on the Docker network::

      STRAPI_INTERNAL_URL=http://strapi:1337

- ``STRAPI_URL`` (Python pipeline)

  Internal Strapi URL used by the Python data pipeline in ``pipeline/``. Like
  ``STRAPI_INTERNAL_URL``, it normally points at the Docker service name::

      STRAPI_URL=http://strapi:1337

CORS Policy
-----------

The Nginx gateway applies a conservative CORS policy so that only the
application origin can access cross-origin resources such as tiles and
assets.

In ``nginx/nginx.conf`` a ``map`` directive derives an allowed CORS origin
from the ``Origin`` header:

.. code-block:: nginx

   map $http_origin $cors_allow_origin {
     default "";
     ~^https?://app(\.[^/:]+)?(:[0-9]+)?$ $http_origin;
   }

This pattern matches both development (``http://app.local``) and production
hosts (``https://app.example.com`` or ``https://app.staging.example.com``).

The assets and tiles virtual hosts then apply CORS headers only when a request
comes from the application origin:

.. code-block:: nginx

   add_header Access-Control-Allow-Origin $cors_allow_origin always;
   add_header Access-Control-Allow-Methods $cors_allow_methods always;
   add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept" always;

Preflight ``OPTIONS`` requests are answered with a short 204 response. Other
origins do not receive any ``Access-Control-Allow-*`` headers, so modern
browsers will block cross-origin asset or tile access from untrusted sites.

Local Development Checklist
---------------------------

For a typical local Docker development environment:

1. Add the following lines to ``/etc/hosts`` (requires sudo)::

      127.0.0.1 app.local db.local assets.local tiles.local

2. Ensure ``.env`` (or ``.env.example``) has the browser-facing URLs set to
   these hostnames::

      NEXT_PUBLIC_STRAPI_URL=http://db.local
      NEXT_PUBLIC_TILESERVER_URL=http://tiles.local
      NEXTAUTH_URL=http://app.local

3. Start the stack with Docker Compose::

      docker-compose up --build

After that you should be able to access:

- ``http://app.local`` for the web application
- ``http://db.local`` for the Strapi admin
- ``http://assets.local`` for static assets and uploads
- ``http://tiles.local`` for tile diagnostics or direct testing

Production Notes
----------------

In production you will typically terminate TLS in front of the Nginx gateway
or enable TLS directly in Nginx. The host-based routing pattern remains the
same, but with real domains instead of ``*.local``.

Recommended adjustments:

- Use HTTPS endpoints in the browser-facing environment variables, for
      example::

                  NEXT_PUBLIC_STRAPI_URL=https://db.example.com
                  NEXT_PUBLIC_TILESERVER_URL=https://tiles.example.com
                  NEXTAUTH_URL=https://app.example.com

- Ensure that the TLS terminator (load balancer, reverse proxy, or Nginx
      itself) sets ``X-Forwarded-Proto=https`` so that Next.js and Strapi generate
      correct absolute URLs and redirects.

- Consider enabling HTTP Strict Transport Security (HSTS) on the public
      entrypoints once HTTPS is stable, for example in Nginx::

                  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

- Keep ``STRAPI_INTERNAL_URL`` and ``STRAPI_URL`` pointed at the internal
      Docker service (for example ``http://strapi:1337``) so that backend services
      do not depend on external DNS or TLS during internal communication.

With this setup, moving from local development to production is mostly a
matter of updating DNS and the browser-facing environment variables; the
application code and internal service topology remain unchanged.

