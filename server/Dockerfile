FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npx", "nodemon", "--legacy-watch", "--exec", "npx ts-node src/index.ts", "--ext", "ts"]
