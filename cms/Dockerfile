FROM node:18-alpine

WORKDIR /srv/app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json .
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# The container runs as HOST_UID:HOST_GID (docker-compose.yml, default
# 1000:1000) so files it writes under a bind mount (e.g. public/uploads)
# land on the host owned by that user, not root. Strapi also writes at
# runtime to plain image paths that aren't bind-mounted (e.g.
# database/migrations), so the whole tree needs to be owned by that same
# uid/gid -- otherwise those writes fail with EACCES, since everything
# up to this point was built as root.
RUN chown -R 1000:1000 /srv/app

EXPOSE 1337
CMD ["npm", "run", "start"]
