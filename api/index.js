// Vercel serverless entry: re-exports the compiled Express app.
// The backend is built to backend/dist by the root build script before Vercel
// bundles this function, so the import target always exists.
import { app } from "../backend/dist/app.js";

export default app;
