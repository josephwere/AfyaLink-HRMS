FROM node:18-alpine

WORKDIR /app

# Copy only package.json
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy rest of backend code
COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
