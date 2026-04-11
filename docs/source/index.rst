Tama Hidrovias Documentation
============================

Tama Hidrovias is a multi-service hydrology platform for forecast generation,
data processing, raster serving, and interactive map visualization.

The repository is organized as a coordinated set of services:

- ``web/`` for the frontend application
- ``cms/`` for the CMS and API
- ``pipeline/`` for the data pipeline
- ``pgadmin/`` for pgAdmin bootstrap configuration
- ``tileserver/`` for raster tile delivery

.. note::

   This project is under active development.

Documentation Language Policy
-----------------------------

The project intentionally uses two documentation registers:

- The root ``README.rst`` is written primarily in Portuguese for onboarding,
   local setup, and platform overview.
- The Sphinx documentation in ``docs/source/`` is written primarily in English
   for technical architecture, implementation details, and release tracking.

Code-facing role names, route names, and component names remain unchanged
across both sets of documents. In particular, the application role names are
always:

- ``authenticated``
- ``viewer``
- ``analyst``

Terminology Mapping
-------------------

Use the following equivalences when reading the Portuguese root documents and
the English Sphinx pages together:

+------------------------+-----------------------------------------------+
| Portuguese term        | Preferred English technical term              |
+========================+===============================================+
| painel                 | dashboard                                     |
+------------------------+-----------------------------------------------+
| modo leitura           | read-only mode                                |
+------------------------+-----------------------------------------------+
| perfil                 | role                                          |
+------------------------+-----------------------------------------------+
| estacao virtual        | virtual station                               |
+------------------------+-----------------------------------------------+
| criacao e edicao       | write actions / write flows                   |
+------------------------+-----------------------------------------------+

When a descriptive phrase differs from runtime behavior, the authoritative
technical reference is the Sphinx documentation plus the implementation in
``web/`` and ``cms/``.

Contents
--------

.. toctree::

   usage
   authentication
   dashboard
   preferences
   changelog
   api
