# Rift Rewind frontend

React 19 + TypeScript + Vite client for the local Rift Rewind API.

```powershell
npm install
npm run dev
```

The development server proxies `/api` to `http://127.0.0.1:8000`. Override this with `VITE_API_BASE_URL` when needed.

The main experience is an interactive four-waypoint Runeterra map. Region selection and evidence come from the backend; the frontend only presents the resulting journey.

Production verification:

```powershell
npm run build
npm run lint
```
