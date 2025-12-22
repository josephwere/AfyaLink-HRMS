Migration notes
===============
- Removed legacy hl7 package and react-scripts (CRA).
- Project migrated to Vite. Use `npm install` then `npm run dev` to start.
- Dev dependencies added: vite, @vitejs/plugin-react. Please run `npm install` to fetch.
- If your project relies on server-side HL7 parsing, reintroduce a modern HL7 parser on the backend.
- If you use environment variables, move them from .env to VITE_ prefixed variables for client access.
