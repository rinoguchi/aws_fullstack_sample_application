FROM node:14.17.0

WORKDIR /usr/src/app
COPY package.json .
COPY tsconfig.json .
COPY src ./src

RUN npm install
RUN npx tsc

EXPOSE 3000

CMD ["node", "dist/index.js"]