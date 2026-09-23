Guia Rápido: Subir o Stack Local
==================================

Este é um guia focado **apenas** em subir e derrubar o ambiente de
desenvolvimento local via Docker Compose. Para visão geral da plataforma,
onboarding completo, contas de teste, pipeline Python etc., veja o
``README.rst`` na raiz -- este documento cobre só o "como rodar".

Pré-requisitos
---------------

- Docker e Docker Compose (plugin ``docker compose``, não o script antigo
  ``docker-compose``).
- Um arquivo ``.env`` na raiz do projeto (copie de ``.env.example`` na
  primeira vez):

  .. code-block:: bash

      cp .env.example .env
      # edite .env com seus tokens/chaves (Mapbox, Copernicus CDS, etc.)

Subindo o stack
----------------

Modo desenvolvimento (recomendado no dia a dia)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Usa ``docker-compose.dev.yml`` como override: ``strapi`` roda com
``npm run develop`` (hot reload) e ``web`` com ``next dev`` na porta 3000,
com os diretórios ``cms/`` e ``web/`` montados como volumes.

.. code-block:: bash

    HOST_UID=$(id -u) HOST_GID=$(id -g) \
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build \
      postgres pgadmin titiler strapi web

Em Linux/WSL, sempre defina ``HOST_UID``/``HOST_GID`` como acima -- sem
isso, arquivos criados pelos containers (ex.: ``node_modules``,
``tsconfig.tsbuildinfo``) ficam com dono ``root`` no host.

Modo "produção local" (sem hot reload)
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Usa só o ``docker-compose.yml`` base -- builda as imagens de produção
(``next build`` / ``strapi build``) em vez de rodar em modo dev. Útil para
testar exatamente o que vai para produção antes de fazer deploy.

.. code-block:: bash

    HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose up --build -d

Se a porta 1337 do host já estiver ocupada
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Sintoma: a página do Strapi carrega em branco, ou responde mas não é o
Strapi de verdade (algum outro processo/VPN/ambiente remoto já está usando
a porta 1337 no host). Publique o Strapi em outra porta com
``STRAPI_HOST_PORT``:

.. code-block:: bash

    HOST_UID=$(id -u) HOST_GID=$(id -g) STRAPI_HOST_PORT=1338 \
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build \
      postgres pgadmin titiler strapi web

O painel fica então em ``http://localhost:1338/admin``. Isso só muda a
porta *do host* -- dentro da rede Docker, o ``web`` sempre fala com o
Strapi por ``http://strapi:1337``, não muda nada nesse lado.

Acessando os serviços
-----------------------

.. list-table::
   :header-rows: 1
   :widths: 20 35 45

   * - Serviço
     - URL padrão
     - Observação
   * - ``web``
     - http://localhost:3000
     - Frontend público + dashboard
   * - ``strapi`` (admin)
     - http://localhost:1337/admin
     - ou ``:1338`` se usou ``STRAPI_HOST_PORT``
   * - ``pgadmin``
     - http://localhost:5050
     - Login: ``PGADMIN_DEFAULT_EMAIL``/``_PASSWORD``
   * - ``titiler``
     - http://localhost:8002
     - ``TITILER_HOST_PORT``, padrão 8002
   * - ``postgres``
     - ``localhost:5432`` (via pgAdmin)
     - Sem interface web própria

Primeira entrada no Strapi: se o banco estiver vazio (volume novo), o
próprio Strapi mostra o formulário "Create your first administrator" no
primeiro acesso -- não precisa de nenhum passo manual. Detalhes completos
de acesso ao CMS estão em ``README.rst`` (seção "Acesso ao Painel
Administrativo do Strapi").

Verificando que subiu corretamente
------------------------------------

.. code-block:: bash

    docker compose -f docker-compose.yml -f docker-compose.dev.yml ps

    curl -s -o /dev/null -w 'web:     HTTP %{http_code}\n' http://localhost:3000
    curl -s -o /dev/null -w 'strapi:  HTTP %{http_code}\n' http://localhost:1337/admin
    curl -s -o /dev/null -w 'pgadmin: HTTP %{http_code}\n' http://localhost:5050
    curl -s -o /dev/null -w 'titiler: HTTP %{http_code}\n' http://localhost:8002/cog/info

``titiler`` retornando ``422`` é esperado (falta o parâmetro ``url``) --
significa que está respondendo normalmente. Se ``strapi``/``pgadmin``
derem ``HTTP 000`` logo após subir, normalmente ainda estão inicializando;
espere ~15-20s e tente de novo (``strapi`` em modo dev pode levar um tempo
para compilar na primeira vez).

Logs
-----

.. code-block:: bash

    docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f strapi web

Reiniciar um serviço (útil após muitas horas de hot reload acumulado)
------------------------------------------------------------------------

Se o Next.js Fast Refresh parecer "travado" num estado estranho após uma
sessão de desenvolvimento muito longa, reiniciar o container do ``web``
costuma resolver sem precisar recriar tudo:

.. code-block:: bash

    docker compose -f docker-compose.yml -f docker-compose.dev.yml restart web

Derrubando o stack
--------------------

.. code-block:: bash

    docker compose -f docker-compose.yml -f docker-compose.dev.yml down

Se o Docker avisar sobre containers órfãos antigos:

.. code-block:: bash

    docker compose -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans

Isso **não** apaga os volumes (dados do Postgres, uploads do Strapi
persistem). Para realmente zerar o ambiente, adicione ``-v``:

.. code-block:: bash

    docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
