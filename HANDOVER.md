# Handover: Grievance Redressal Tool (ESG department)

Live test site: https://purva-esg.vercel.app/

This app sends every complaint to the ESG department, by tier (L1, L2, L3, HEAD).
A sister app, **purva-main**, routes complaints across all six departments; it is the
same code base without ESG testing mode.

ESG testing mode is two settings: `SINGLE_DEPARTMENT=ESG` on the backend and
`VITE_SINGLE_DEPARTMENT_MODE=true` on the website. Clear the first and set the second to
`false` to use all six departments.

## What there is to host

| Part | Folder | Runs as | Now hosted on |
|------|--------|---------|---------------|
| Website | `frontend/` | Static site built with Vite (React) | Vercel |
| Backend API | `backend/`, `agents/`, `rag/` | Python 3.11, FastAPI (`uvicorn`) | Render |
| Embedding service | `deploy/hf-embed-space/` | Gradio app on Hugging Face Spaces | Hugging Face |
| Database, logins, file storage | `backend/database/` (SQL) | Supabase | Supabase |

The website talks to the backend (`VITE_API_BASE_URL`) and to Supabase directly for
login. The backend talks to Supabase, Groq (AI model), the embedding service and Brevo
(email).

## 1. Database (Supabase)

Follow `backend/database/README.md`: run the SQL files in the listed order, turn on
row-level security for the backend-only tables, and set the Auth URLs to the new
website address.

## 2. Backend

```bash
pip install -r requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
```

- Health check: `GET /health` returns `{"status": "healthy", ...}`.
- `requirements.txt` is the light install (no PyTorch, about 200 MB of memory).
  The policy index ships in the repo (`rag/chroma_final`, `rag/data`).
- `render.yaml` is a ready Render blueprint. On another host, use the same build and
  start commands.
- Settings: see `backend/.env.example`. Every name is marked [REQUIRED] or [OPTIONAL].
  Summary:
  - Required: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
    `GROQ_API_KEY`, `FRONTEND_URL`, `EMBED_URL`, `EMBED_KEY`, `HF_TOKEN`,
    `BREVO_API_KEY`, `EMAIL_FROM`
  - Optional: `LLM_PROVIDER`, `GROQ_MODEL`, `EMAIL_FROM_NAME`, `REQUIRE_PHONE_VERIFIED`,
    `OTP_DEV_MODE`, `TWILIO_*`, `SMTP_*`, `OLLAMA_*`, `SINGLE_DEPARTMENT`
  - One-time admin setup only: `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`,
    `SEED_ADMIN_PASSWORD`
- `FRONTEND_URL` must be the website address, or the browser will block its requests
  (CORS).

## 3. Website

```bash
cd frontend
npm install
npm run build        # output in frontend/dist
```

- Settings: see `frontend/.env.example`. They are built into the site, so set them
  before building: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL`
  (required), `VITE_REQUIRE_PHONE_OTP`, `VITE_SINGLE_DEPARTMENT_MODE` (optional).
- It is a single-page app: the server must send `index.html` for every path
  (`frontend/vercel.json` does this on Vercel).

## 4. Embedding service

See `deploy/hf-embed-space/README.md`. Create a Gradio Space from that folder, set its
`EMBED_KEY` secret, and give the backend the same `EMBED_KEY`, the Space URL as
`EMBED_URL`, and a Hugging Face token as `HF_TOKEN`. Without it the chatbot still works
but uses keyword-only policy search.

## Keys and secrets

No keys are stored in this repository or its history. Secret values (Supabase service
role key, Groq, Brevo, Hugging Face, Twilio) are shared separately and set only as
environment variables on the backend. The website only ever gets the Supabase **anon**
key, which is meant to be public.

## Sharing a Supabase project with purva-main

Both apps currently use the **same** Supabase project. They can keep sharing one (run
both apps' extra SQL files, see `backend/database/README.md`), or each can have its own.
