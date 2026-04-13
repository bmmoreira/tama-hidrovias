TaMa Hidrovias – Plataforma de Previsão Hidrológica
====================================================

.. image:: https://img.shields.io/badge/license-MIT-blue.svg
   :target: LICENSE

**TaMa Hidrovias** é uma plataforma integrada de previsão hidrológica para a
região dos rios Madeira e Tapajós, focada no monitoramento de hidrovias e
gestão de recursos hídricos. O sistema processa dados climáticos, recorta
regiões hidrográficas específicas e serve camadas raster interativas para
visualização em mapas hidrográficos brasileiros. A plataforma combina dados de
reanálise climática, processamento geoespacial em Python, uma API headless
Strapi, visualização interativa com Next.js e serviço de camadas raster via
TileServer-GL.

.. image:: assets/logo5.png
   :alt: Logo da plataforma Tama Hidrovias
   :width: 200px

.. contents:: Conteúdo
   :depth: 2
   :local:

Idioma e Terminologia
---------------------

O projeto usa dois registros de documentação:

- O ``README.rst`` na raiz prioriza **português** para onboarding, operação do
  ambiente e visão geral da plataforma.
- A documentação Sphinx em ``docs/source/`` prioriza **inglês** para referência
  técnica, arquitetura, autenticação, changelog e detalhes de implementação.

Para manter consistência entre os dois conjuntos de documentos, os termos de
produto e autorização abaixo devem ser interpretados como equivalentes:

+------------------------+-----------------------------------------------+
| Termo no README        | Termo preferido na documentação técnica       |
+========================+===============================================+
| painel                 | dashboard                                     |
+------------------------+-----------------------------------------------+
| modo leitura           | read-only mode                                |
+------------------------+-----------------------------------------------+
| perfil                 | role                                          |
+------------------------+-----------------------------------------------+
| estação virtual        | virtual station                               |
+------------------------+-----------------------------------------------+
| criação e edição       | write actions / write flows                   |
+------------------------+-----------------------------------------------+

Os nomes de papéis da aplicação permanecem em inglês no código e na
documentação, mesmo quando o texto explicativo estiver em português:

- ``authenticated``
- ``viewer``
- ``analyst``

Sempre que houver divergência entre texto descritivo e comportamento do
sistema, a referência normativa deve ser:

1. documentação Sphinx em ``docs/source/`` para arquitetura e fluxos técnicos;
2. arquivos de implementação no ``web/`` e no ``cms/`` para comportamento em runtime.

Arquitetura
-----------

.. code-block:: text

    ┌──────────────────────────────────────────────────────────┐
    │                     Fontes de Dados                      │
    │         Remote Repository  ·  Shapefiles                 │
    └───────────────────────┬──────────────────────────────────┘
                            │
                            ▼
    ┌───────────────────────────────────────┐
    │         Python Worker (pipeline)      │
    │  · Download                           │
    │  · Recorte  (GDAL/Shapely)            │
    │  · Geração de GeoTIFF / NetCDF        │
    │  · Publicação via API REST → Strapi   │
    └───────────┬───────────────────────────┘
                │                   │
                ▼                   ▼
    ┌───────────────────┐  ┌────────────────────┐
    │   Strapi (API)    │  │  TileServer-GL     │
    │   porta 1337      │  │  porta 8080        │
    │   PostgreSQL 15   │  │  GeoTIFF → XYZ/PNG │
    └─────────┬─────────┘  └────────┬───────────┘
              │                     │
              └──────────┬──────────┘
                         ▼
              ┌────────────────────┐
              │   Next.js (UI)     │
              │   porta 3000       │
              │   Mapbox GL JS     │
              └────────────────────┘

Estrutura do Repositório
------------------------

O repositório raiz funciona como camada de orquestração. As aplicações
executáveis vivem nos diretórios de serviço:

.. code-block:: text

    tama-hidrovias/
    ├── web/           # frontend
    ├── cms/           # CMS e API
    ├── pipeline/      # pipeline de dados e testes
    ├── pgadmin/       # bootstrap config do pgAdmin
    ├── tileserver/    # serviço de tiles raster
    ├── data/          # dados locais brutos e processados
    ├── docs/          # documentação Sphinx
    ├── assets/        # branding compartilhada (fonte canônica)
    ├── CONTRIBUTING.md
    └── docker-compose.yml

Início Rápido com Docker
-------------------------

Este fluxo corresponde ao ``Quick Start`` descrito na documentação técnica.

.. code-block:: bash

    # 1. Clone e configure variáveis de ambiente
    cp .env.example .env
    # Edite .env com seus tokens e chaves

    # 2. Suba todos os serviços
    docker compose up --build -d

    # 3. Acesse a plataforma
    # Frontend:    http://localhost:3000
    # API Strapi:  http://localhost:1337/admin
    # pgAdmin:     http://localhost:5050
    # TileServer:  http://localhost:8080

Serviços
--------

+----------------+-------+---------------------------------------------------+
| Serviço        | Porta | Descrição                                         |
+================+=======+===================================================+
| ``web``        | 3000  | Interface web com mapas interativos (Mapbox GL)   |
+----------------+-------+---------------------------------------------------+
| ``strapi``     | 1337  | API headless REST/GraphQL + painel de administração|
+----------------+-------+---------------------------------------------------+
| ``pgadmin``    | 5050  | Interface web gráfica para administrar o PostgreSQL|
+----------------+-------+---------------------------------------------------+
| ``tileserver`` | 8080  | Servição de camadas raster GeoTIFF via TileJSON   |
+----------------+-------+---------------------------------------------------+
| ``postgres``   | 5432  | Banco de dados PostgreSQL 15                      |
+----------------+-------+---------------------------------------------------+
| ``python-worker`` | –  | Pipeline de dados (sem porta exposta)             |
+----------------+-------+---------------------------------------------------+

Pipeline Python
---------------

O worker Python executa as seguintes etapas automaticamente:

1. **Download** de dados (com variáveis hidrológicas) via ``cdsapi``
2. **Recorte espacial** da bacia hidrográfica usando o shapefile configurado em
   ``BASIN_SHAPEFILE``
3. **Conversão** NetCDF → GeoTIFF com reprojeção para EPSG:4326
4. **Publicação** dos metadados e caminhos de arquivo na API Strapi
5. Os GeoTIFFs ficam disponíveis em ``./data/geotiffs/`` para o TileServer-GL

Para rodar o pipeline manualmente:

.. code-block:: bash

    docker compose run --rm python-worker

Administração do Banco
----------------------

O stack inclui um ``pgAdmin`` acessível pelo navegador em
``http://localhost:5050``.

- Login: use ``PGADMIN_DEFAULT_EMAIL`` e ``PGADMIN_DEFAULT_PASSWORD`` do seu
  arquivo ``.env``.
- O servidor PostgreSQL principal é pré-cadastrado como ``Tama Hidrovias
  Postgres``.
- Na primeira conexão ao servidor, informe a senha do banco PostgreSQL
  (por padrão, ``POSTGRES_PASSWORD``).

Configuração para Desenvolvimento
-----------------------------------

Docker Compose em modo dev
~~~~~~~~~~~~~~~~~~~~~~~~~~

Para rodar o frontend Next.js e o Strapi em modo de desenvolvimento dentro do
Docker, use o arquivo base com o override ``docker-compose.dev.yml``:

.. code-block:: bash

  docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build \
    postgres pgadmin tileserver strapi web

Esse fluxo mantém:

- ``strapi`` com ``npm run develop`` e recarga de arquivos por polling
- ``web`` com ``next dev`` na porta ``3000``
- volumes montados para ``cms/`` e ``web/``

Para acompanhar logs do ambiente dev:

.. code-block:: bash

  docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f strapi web

Para recriar as contas de desenvolvimento usadas em testes de login no ambiente dev:

.. code-block:: bash

  docker compose -f docker-compose.yml -f docker-compose.dev.yml exec strapi \
    npm run bootstrap:dev-users

Credenciais padrão do usuário de desenvolvimento:

- analista: ``dev.analyst@local.test`` / ``devpass123``
- viewer: ``dev.viewer@local.test`` / ``devviewer123``

Comportamento esperado:

- o usuário ``analista`` acessa ``/dashboard/admin`` e fluxos de escrita aprovados
- o usuário ``viewer`` entra no dashboard em modo leitura e é redirecionado ao tentar acessar ``/dashboard/admin``

Para encerrar o stack:

.. code-block:: bash

  docker compose -f docker-compose.yml -f docker-compose.dev.yml down

Se o Docker avisar sobre containers órfãos antigos, limpe com:

.. code-block:: bash

  docker compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans

Python
~~~~~~

.. code-block:: bash

    cd pipeline
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    pip install -e .
    pytest

Next.js
~~~~~~~

.. code-block:: bash

    cd web

Mapa ``/mapview`` e camadas GeoJSON
-----------------------------------

O projeto agora inclui uma rota dedicada ``/mapview`` no frontend para testar e
evoluir uma visualização baseada em Mapbox com sobreposição GeoJSON carregada a
partir do Strapi.

Fluxo atual:

- o frontend chama ``/api/map-feature-collections`` no próprio app Next.js
- essa rota faz proxy para ``GET /api/map-feature-collections/public`` no Strapi
- o Strapi devolve um registro com o campo JSON ``featureCollection``
- o componente ``web/src/components/maps/MapBase.tsx`` renderiza esse payload
  como ``Source`` + ``Layer`` do Mapbox
- os controles compartilhados de busca e detalhe de estação agora vivem em
  ``web/src/components/maps/StationExplorerOverlay.tsx`` e podem ser montados
  tanto em ``/map`` quanto em ``/mapview``

No backend Strapi existe o single type ``Map Feature Collection`` com:

- ``name``
- ``geojsonFile`` para upload opcional do arquivo fonte
- ``featureCollection`` com o GeoJSON efetivamente servido ao frontend

O estilo visual dessa camada GeoJSON no ``/mapview`` agora pode ser ajustado
na página administrativa do dashboard e é persistido no model global
``App Setting`` do Strapi.

Configurações disponíveis atualmente:

- raio do círculo
- opacidade
- cor para anomalia positiva
- cor para anomalia negativa
- espessura da borda
- cor da borda

A tela administrativa também exibe uma pequena pré-visualização ao vivo antes
de salvar.

Como atualizar os dados:

1. abra ``http://localhost:1337/admin``
2. abra o single type ``Map Feature Collection``
3. envie um arquivo ``.geojson`` ou ``.json`` em ``geojsonFile`` ou edite o
   campo ``featureCollection`` manualmente
4. salve o registro
5. recarregue ``http://localhost:3000/mapview``

O ciclo de vida do Strapi valida o GeoJSON e importa automaticamente o arquivo
enviado para o campo JSON ao salvar.

Para detalhes técnicos completos, rotas, fluxo de carregamento e caminhos de
expansão, consulte:

- ``docs/source/mapview.rst``
- ``cms/README.md``
- ``web/README.md``
    npm install
    npm run dev        # http://localhost:3000

Strapi
~~~~~~

.. code-block:: bash

    cd cms
    npm install
    npm run develop    # http://localhost:1337/admin

  Transferir dados atuais do Strapi
  -------------------------------

  Para levar usuários, papéis, conteúdo e uploads atuais para outra máquina,
  use o script de backup e restauração na raiz do projeto:

  .. code-block:: bash

    ./strapi-data-transfer.sh export
    ./strapi-data-transfer.sh import backups/strapi/strapi-data-YYYYMMDD-HHMMSS.tar.gz

  O script exporta:

  - dump PostgreSQL com os dados atuais do Strapi
  - arquivos em ``cms/public/uploads``

  Se você estiver usando a stack de desenvolvimento com ``docker-compose.dev.yml``,
  adicione ``--dev`` ao comando.

Autenticação
------------

O frontend usa **NextAuth** e o CMS usa **Strapi Users & Permissions**.

- O login do usuário acontece no ``web`` via NextAuth Credentials Provider.
- As credenciais são validadas no Strapi por ``/api/auth/local``.
- O JWT do Strapi fica apenas no servidor do Next.js.
- O navegador usa rotas internas do Next.js para operações autenticadas.

Para a documentação completa do sistema de autenticação, consulte
``docs/source/authentication.rst``.

Ao longo deste README, o termo **painel** corresponde ao termo **dashboard**
usado na documentação Sphinx.

Perfis e Customizações
----------------------

O projeto passou a ter uma camada explícita de perfis e comportamento de
painel para diferenciar usuários com acesso somente leitura daqueles com
acesso operacional.

Perfis documentados hoje:

- ``authenticated``: papel padrão do Strapi. Deve ser tratado como fallback e
  não recebe permissões de escrita no painel.
- ``viewer``: acesso de leitura ao painel. Pode navegar, consultar dados,
  relatórios e mapas, mas não executa ações de criação ou edição.
- ``analyst``: acesso operacional ao painel. Além da leitura, pode executar
  fluxos de escrita já liberados pela aplicação e pelo Strapi.

Customizações implementadas:

- O Strapi cria automaticamente os papéis ``viewer`` e ``analyst`` em
  ``cms/src/extensions/users-permissions/strapi-server.js``.
- O endpoint ``/api/users/me`` foi sobrescrito para devolver o papel populado,
  o que permite ao NextAuth montar a sessão com ``session.user.role`` de forma
  confiável.
- O frontend centraliza normalização e checagens de papel em
  ``web/src/lib/roles.ts``.
- O painel exibe indicadores visuais de modo leitura para ``viewer`` e usa
  botões protegidos para manter ações visíveis, porém bloqueadas quando o papel
  não permite escrita.
- As rotas internas ``POST /api/stations`` e ``PATCH`` / ``DELETE`` em
  ``/api/stations/[id]`` validam o papel no servidor antes de encaminhar a
  escrita ao Strapi.
- As ações destrutivas do painel usam modal de confirmação próprio e feedback
  visual por toast, mantendo o fluxo consistente com o restante da interface.

No conjunto Sphinx, essas mesmas customizações aparecem descritas com os termos
``dashboard``, ``read-only`` e ``protected actions``.

Para detalhes operacionais e inventário das customizações, consulte também:

- ``docs/source/authentication.rst``
- ``docs/source/dashboard.rst``
- ``web/README.md``
- ``cms/README.md``

Estrutura de Dados
------------------

.. code-block:: text

    data/
    ├── geotiffs/          # Rasters processados (montados no TileServer)
    ├── shapefiles/        # Shapefile da bacia hidrográfica
    │   └── basin.shp
    ├── raw/               # NetCDF brutos baixados do ERA5
    └── processed/         # Dados intermediários / CSVs

.. note::
   Os arquivos de dados são ignorados pelo Git (ver ``.gitignore``).
   Apenas a estrutura de diretórios é versionada via arquivos ``.gitkeep``.

Variáveis de Ambiente
---------------------

Arquivos recomendados por contexto:

- ``/.env.example``: variáveis compartilhadas usadas pelo ``docker compose``
- ``web/.env.example``: desenvolvimento isolado do frontend
- ``cms/.env.example``: desenvolvimento isolado do Strapi

Copie o arquivo apropriado para ``.env`` e preencha os valores:

.. list-table::
   :header-rows: 1
   :widths: 30 70

   * - Variável
     - Descrição
   * - ``POSTGRES_PASSWORD``
     - Senha do banco de dados PostgreSQL
   * - ``PGADMIN_DEFAULT_EMAIL``
     - Login inicial do pgAdmin no navegador
   * - ``PGADMIN_DEFAULT_PASSWORD``
     - Senha inicial do pgAdmin no navegador
   * - ``APP_KEYS``
     - Chaves de sessão do Strapi (gere valores aleatórios)
   * - ``ADMIN_JWT_SECRET``
     - Segredo JWT para o painel Strapi
   * - ``NEXT_PUBLIC_MAPBOX_TOKEN``
     - Token público do Mapbox GL JS
   * - ``NEXT_PUBLIC_STRAPI_URL``
     - URL pública do Strapi acessível pelo navegador
   * - ``STRAPI_INTERNAL_URL``
     - URL interna usada pelo servidor Next.js para falar com o Strapi sem expor o JWT ao navegador
   * - ``NEXT_PUBLIC_TILESERVER_URL``
     - URL pública do TileServer acessível pelo navegador
   * - ``FAKE_AUTH``
     - Define ``true`` para liberar o dashboard com sessão falsa em desenvolvimento
   * - ``CDS_API_KEY``
     - Chave da API Copernicus Climate Data Store
   * - ``STRAPI_TOKEN``
     - Token bearer usado pelo pipeline Python para publicar dados no Strapi

Licença
-------

MIT © Tama Hidrovias Contributors
