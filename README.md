# NeuroICU Medical Workflow Automation Frontend

This frontend supports the voice-note workflow for uploading or recording audio, reviewing the transcription, generating SOAP notes, and confirming the final result.

## Stack

- React 19 + TypeScript + Vite
- React Router for app routing
- Tailwind CSS 4 utilities
- Axios for backend communication

## Routes

- `/` redirects to `/workflow`
- `/workflow` renders the main SOAP automation flow
- `*` renders a not-found page

## Project Structure

```text
src/
  app/
    App.tsx
    layouts/
    routes/
    styles/
  features/
    soap-workflow/
      components/
      hooks/
      lib/
      services/
      constants.ts
      types.ts
  pages/
  shared/
    api/
    components/ui/
    config/
    lib/
```

## Local Development

```bash
npm install
npm run dev
```

## Environment

Create a `.env` file from `.env.example`.

```bash
VITE_API_BASE_URL=http://localhost:3000/api
VITE_UPLOAD_VOICE_PATH=/upload-voice
VITE_GET_SOAPS_PATH=/get-soap
VITE_CONFIRM_SOAP_PATH=/confirm-soap-notes
```

Compatibility fallbacks are also supported for older setups:

- `VITE_API_URL`
- `VITE_SOAP_UPLOAD_URL`

## Working Conventions

- Use `@/` imports for source files.
- Keep domain logic inside `features/soap-workflow`.
- Keep reusable UI and app-wide utilities inside `shared`.
- Put route composition in `app/routes` and route-level screens in `pages`.

## Quality Checks

```bash
npm run lint
npm run build
```
