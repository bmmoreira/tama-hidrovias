FROM node:18-alpine

WORKDIR /srv/app

RUN apk add --no-cache libc6-compat python3 make g++

COPY package.json .
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 1337
CMD ["npm", "run", "start"]
