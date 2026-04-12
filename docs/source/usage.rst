Usage
=====

.. _installation:

Development Setup
-----------------

The repository root is an orchestration layer. For most work, run the service
you are actively changing.

Full stack with Docker
~~~~~~~~~~~~~~~~~~~~~~

.. code-block:: bash

   cp .env.example .env
   docker compose up --build

Then open ``http://localhost:5050`` to manage PostgreSQL through pgAdmin.

Frontend
~~~~~~~~

.. code-block:: bash

   cd web
   npm install
   npm run dev

Strapi API
~~~~~~~~~~

.. code-block:: bash

   cd cms
   npm install
   npm run develop

Python Pipeline
~~~~~~~~~~~~~~~

.. code-block:: bash

   cd pipeline
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   pip install -e .
   pytest

Authentication
~~~~~~~~~~~~~~

The project uses NextAuth in ``web`` and Strapi Users & Permissions in ``cms``.

- The login form posts credentials to NextAuth.
- NextAuth authenticates against Strapi ``/api/auth/local``.
- The Strapi JWT is kept server-side and is not exposed to the browser.
- Authenticated browser requests should go through internal Next.js API routes.

See :doc:`authentication` for the full architecture, file map, roles, and
extension pattern.

Dashboard permissions and role-specific UI customizations are documented in
:doc:`dashboard`.

Preferences, runtime i18n behavior, and global guest map defaults are
documented in :doc:`preferences`.

Environment Files
-----------------

- Use ``/.env.example`` as the shared Docker Compose template.
- Use ``web/.env.example`` for frontend-specific local development.
- Use ``cms/.env.example`` for Strapi-specific local development.

pgAdmin Access
--------------

- Sign in with ``PGADMIN_DEFAULT_EMAIL`` and ``PGADMIN_DEFAULT_PASSWORD`` from ``.env``.
- The main PostgreSQL server is preloaded as ``Tama Hidrovias Postgres``.
- Use the PostgreSQL database password when connecting to the server for the first time.
