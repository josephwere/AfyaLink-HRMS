#!/usr/bin/env node
import { createServer } from 'vite';

const server = await createServer({
  server: {
    middlewareMode: false,
    host: '0.0.0.0',
    port: 5173,
  },
});

await server.listen();
console.log('Vite dev server is running on http://localhost:5173');
