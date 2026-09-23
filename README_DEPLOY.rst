Guia de Deploy: Como Enviar Atualizações para os Ambientes Remotos
=====================================================================

Este documento descreve, na prática, como fazer deploy de mudanças do
repositório para cada ambiente remoto atualmente em uso. Não cobre como
rodar o stack localmente -- veja ``README_LOCAL_STACK.rst`` para isso.

Visão Geral dos Ambientes
----------------------------

.. list-table::
   :header-rows: 1
   :widths: 15 40 45

   * - Ambiente
     - O que roda lá
     - Como é feito o deploy
   * - ``netuno``
     - Stack completo via Docker Compose (postgres, strapi, web, titiler,
       nginx, python-worker) -- ambiente de teste "próximo de produção"
     - ``scripts/deploy-netuno.sh`` (rsync + ``docker compose up --build``)
   * - ``google``
     - ``web`` (Next.js) standalone via pm2
     - ``scripts/deploy-google.sh`` (rsync + ``npm run build`` +
       ``pm2 reload``)
   * - ``google`` (strapi)
     - ``strapi`` dedicado (instância separada do ``strapi-01`` já
       existente no host) via pm2
     - ``scripts/deploy-google-strapi.sh`` (mesmo padrão, processo pm2
       diferente)
   * - ``cronos-vm1``
     - Stack completo via Docker Compose, mesmo padrão do netuno, mas
       usado como titiler de backup
     - Ainda **manual** -- sem script dedicado ainda. Veja
       `cronos-vm1 (Manual, Sem Script Ainda)`_ abaixo.

Todos os scripts em ``scripts/deploy-*.sh`` aceitam ``--dry-run`` para
mostrar exatamente o que seria sincronizado/alterado sem tocar em nada --
**sempre rode com** ``--dry-run`` **antes de um deploy real** se não tiver
certeza do que mudou.

Pré-requisitos (uma vez só)
------------------------------

- Os hosts ``netuno`` e ``google`` já configurados em ``~/.ssh/config``
  (host, usuário, chave -- veja com quem administra o projeto se precisar
  dessas credenciais).
- Para ``google``: os arquivos de ambiente de produção precisam existir
  localmente antes do primeiro deploy (estão no ``.gitignore`` porque
  contêm segredos):

  - ``scripts/google-env-production.template`` -- variáveis do ``web``
    (token do Mapbox, URLs do Strapi/TiTiler em produção, etc.)
  - ``scripts/google-strapi-env-production.template`` -- variáveis do
    Strapi dedicado (senha do banco, segredos do app)

  Sem esses arquivos, os scripts recusam rodar com uma mensagem de erro
  clara em vez de fazer algo errado silenciosamente.

netuno
-------

Ambiente de teste rodando o stack completo via Docker Compose, atrás de um
Nginx Proxy Manager (NPM) que já existe no host (fora deste projeto) e
termina TLS.

.. code-block:: bash

    ./scripts/deploy-netuno.sh --dry-run   # ver o que mudaria
    ./scripts/deploy-netuno.sh             # aplicar de verdade

O que o script faz:

1. ``rsync`` da árvore de trabalho local inteira para
   ``netuno:/home/hidro/tama`` (**inclui mudanças não commitadas** --
   netuno é um ambiente de teste, não um pipeline de release baseado em
   git). Exclui explicitamente estado "dono do servidor" que nunca deve
   ser sobrescrito por um deploy de rotina: uploads do Strapi
   (``cms/public/uploads/``) e GeoTIFFs do pipeline (``assets/tiff/``).
2. ``docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   --build --remove-orphans`` no host remoto.
3. ``docker image prune -f`` para não acumular imagens antigas.

URLs públicas (via Cloudflare + NPM):

- ``https://tama-hidrovias.brunomoreira.dev`` -- atualmente apontado
  direto para o host ``google``, não para netuno (ver nota abaixo).
- ``https://db.brunomoreira.dev`` -- idem, Strapi também no ``google``.
- ``https://tiles.brunomoreira.dev`` -- TiTiler, permanece no ``netuno``.

.. important::
   Configuração de proxy/DNS (NPM Proxy Hosts, Cloudflare Tunnel) é feita
   manualmente fora deste repositório e não é reaplicada automaticamente
   pelo script. Se um deploy novo introduzir um hostname público novo,
   alguém precisa criar o Proxy Host correspondente no NPM
   (``http://146.164.74.29:4081``) apontando para o container
   ``tama-nginx`` na network ``frontend`` -- isso já mordeu a equipe uma
   vez (``tiles.brunomoreira.dev`` ficou fora do ar por dias porque essa
   entrada nunca tinha sido criada; veja o changelog para o post-mortem).

Portas ajustáveis via variável de ambiente (mesma lógica do
``docker-compose.yml``, ver ``STRAPI_HOST_PORT`` acima): ``netuno`` já usa
outras portas de host para vários desses serviços porque o host tem
outros containers rodando (Portainer na 8000, etc.) -- ver os comentários
em ``docker-compose.yml``/``docker-compose.prod.yml`` para os valores
atuais.

google -- ``web`` (frontend)
-------------------------------

O frontend Next.js roda como processo pm2 standalone nesse host, junto
com outros sites Next.js já existentes (``maphidro``,
``brunomoreira.dev``) -- **não** usa Docker Compose aqui, ao contrário do
netuno. Esse host não roda Postgres/TiTiler próprios para este projeto;
fala com o TiTiler que já vive no netuno.

.. code-block:: bash

    ./scripts/deploy-google.sh --dry-run
    ./scripts/deploy-google.sh

O que o script faz:

1. ``rsync`` só de ``web/`` (não o repositório inteiro) para
   ``google:/home/bmmoreira/projects/nextjs/tama``.
2. Copia ``scripts/google-env-production.template`` para
   ``.env.production`` no host remoto.
3. ``npm install --legacy-peer-deps && npm run build`` no host remoto.
4. ``pm2 reload tama`` (ou ``pm2 start`` se for a primeira vez) +
   ``pm2 save``.

Roda em ``127.0.0.1:3004`` no host. Checar depois:

.. code-block:: bash

    ssh google "pm2 show tama"
    ssh google "pm2 logs tama --lines 100"
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://tama-hidrovias.brunomoreira.dev/map

google -- ``strapi`` dedicado
--------------------------------

Instância Strapi separada, própria deste projeto -- **não** é a mesma
coisa que o processo ``strapi-01`` que já existe nesse host para outro
projeto (versão diferente do Strapi, content types incompatíveis). Nunca
faça merge dos dois.

.. code-block:: bash

    ./scripts/deploy-google-strapi.sh --dry-run
    ./scripts/deploy-google-strapi.sh

Mesmo padrão do deploy do ``web``: rsync de ``cms/`` (excluindo
``public/uploads/``, que é estado do servidor), envia o env de produção,
``npm install && npm run build``, reload via pm2 (processo
``strapi-tama``). Roda em ``127.0.0.1:1339``.

cronos-vm1 (Manual, Sem Script Ainda)
----------------------------------------

Terceiro ambiente com o stack completo via Docker Compose, pensado
principalmente como **backup do TiTiler** (uma segunda instância de tiles
independente do netuno, para poder trocar a origem do Cloudflare Tunnel
rapidamente se o netuno cair). Diferente de netuno/google, ainda não tem
um script ``deploy-cronos-vm1.sh`` dedicado -- o setup inicial foi feito
manualmente via SSH:

.. code-block:: bash

    # 1. Clonar o repositório (branch de trabalho atual)
    ssh cronos-vm1 "cd /home/bmmoreira/tama && git clone <repo-url> ."
    ssh cronos-vm1 "cd /home/bmmoreira/tama && git checkout layers"

    # 2. Criar um .env de produção com segredos novos e únicos para esse
    #    ambiente (nunca reaproveitar senhas/segredos de outro ambiente) --
    #    copiar a estrutura do .env local, mas gerar valores novos para
    #    POSTGRES_PASSWORD, APP_KEYS, JWT_SECRET, etc:
    #      openssl rand -base64 32
    #    e ajustar NEXT_PUBLIC_STRAPI_URL/NEXT_PUBLIC_TILESERVER_URL para
    #    refletir os hosts/portas reais desse ambiente.

    # 3. Portas: este host já tinha outros serviços ocupando 80/443/8000/
    #    8001/5432/5050 (JupyterHub, um outro projeto "sgb-*") -- os
    #    overrides STRAPI_HOST_PORT/NGINX_HOST_PORT/PGADMIN_HOST_PORT/
    #    TITILER_HOST_PORT no .env foram escolhidos para não colidir;
    #    checar portas livres antes de escolher em qualquer host novo:
    #      ssh cronos-vm1 "ss -tln"

    # 4. Subir o stack
    ssh cronos-vm1 "cd /home/bmmoreira/tama && docker compose up -d --build"

Para atualizar depois de um deploy inicial (até existir um script
próprio), o fluxo mais simples é sincronizar via ``git`` em vez de
``rsync`` (esse ambiente, ao contrário de netuno, foi propositalmente
clonado do git, não copiado da árvore local):

.. code-block:: bash

    ssh cronos-vm1 "cd /home/bmmoreira/tama && git pull && docker compose up -d --build"

O TiTiler desse ambiente é exposto diretamente (``TITILER_HOST_PORT``,
sem passar pelo nginx do stack) especificamente para poder ser usado como
origem alternativa de um Cloudflare Tunnel.

Verificando um Deploy Depois de Feito
-----------------------------------------

Independente do ambiente, os checks básicos são os mesmos:

.. code-block:: bash

    # O app está de pé e respondendo?
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' <url-pública>/map

    # Os dados novos (ex.: um GeoJSON substituído) estão realmente sendo servidos?
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' <url-pública>/geojson/<arquivo-novo>
    curl -s -o /dev/null -w 'HTTP %{http_code}\n' <url-pública>/geojson/<arquivo-antigo-removido>  # deve dar 404

Para mudanças visuais (UI, gráficos, animações), abrir de fato num
navegador (ou rodar um teste headless com Playwright) -- checks de
``HTTP 200`` só confirmam que o servidor respondeu, não que a mudança
está correta visualmente.

Erros Já Encontrados (Para Não Repetir)
-------------------------------------------

- **Compose concatena, não substitui, listas de** ``ports:`` **entre
  arquivos** ``-f``. Um valor literal de porta num arquivo de override
  não pode ser removido/trocado por outro arquivo -- só através de uma
  variável de ambiente (``STRAPI_HOST_PORT`` etc). Se precisar de uma
  porta configurável por ambiente, ela tem que estar definida como
  variável desde o arquivo base, nunca hardcoded.
- **Reboot do host derruba containers sem** ``restart:`` **policy.**
  Todos os serviços do stack (exceto os que já tinham ``restart: always``
  antes) agora têm ``restart: unless-stopped`` no ``docker-compose.yml``
  justamente por causa disso -- um reboot do netuno apagou o stack
  inteiro silenciosamente por 9 dias até alguém notar.
- **Nginx Proxy Manager / Cloudflare Tunnel não são geridos por este
  repositório.** Um deploy de código pode rodar perfeitamente e mesmo
  assim o hostname público continuar fora do ar se ninguém tiver
  configurado o proxy/túnel para aquele hostname -- sempre confirme o
  roteamento público de verdade depois de um deploy, não só que o
  processo local subiu.
