# Puravankara Grievance Redressal Mechanism (GRM): ESG department

A web portal where stakeholders (homebuyers, residents, vendors, workers) file grievances
about Puravankara projects, ask a policy chatbot questions, and track their complaints,
while ESG staff work through the complaints in tiered queues with deadlines.

- **Live test site:** https://purva-esg.vercel.app/
- **This app** sends every complaint to the **ESG** department ("ESG testing mode", see
  below). The sister app [purva-main](https://github.com/SmruthiChandrashekar/purva-main) is
  the same code base routing across all six departments.
- **Handing it over or hosting it elsewhere?** Read [HANDOVER.md](HANDOVER.md).

## What it does

| Area | Details |
|------|---------|
| **Filing** | External stakeholder form with a **project picker** (projects come from the `projects` table), file attachments, anonymous filing, incident date (no future dates) |
| **AI triage** | An LLM (Groq, `qwen/qwen3.8-27b`) sets severity (Low / Medium / High). Department is always ESG. Keyword rules force High for POSH, site-safety and bribery mentions. Low form submissions are sent to the chatbot instead of being filed; if the AI is unavailable the complaint is filed as Medium. |
| **Routing and deadlines** | Medium starts at L1, High at L2. Tier deadlines: L1 48 h, L2 24 h, L3 12 h, HEAD 4 h. A background monitor checks every 5 minutes and escalates overdue complaints L1 → L2 → L3 → HEAD. |
| **Policy chatbot ("Purva")** | Answers from ~40 company policy documents using hybrid search (BM25 keywords + vector meaning-based search, merged). Turns complaint-like messages into a filing. |
| **Tracking** | Anyone with a complaint ID (first 5+ characters) sees its status, deadline and documents shared with them. Logged-in users see their own complaints on a dashboard. |
| **Staff** | Admin dashboard (queue, charts, status updates), maker-checker rejection with **AI rejection advice** (checks a proposed rejection reason against the policies), in-app notifications, email alerts. Super admins invite staff, set tiers, deactivate accounts and read the audit log. |
| **Other** | UI in English, Hindi and Kannada; voice input (Groq `whisper-large-v3`); optional phone verification by SMS; light and dark theme; works on phones. |

### ESG testing mode

Two settings, which should match:

| Where | Setting | ESG value | All six departments |
|-------|---------|-----------|---------------------|
| Backend | `SINGLE_DEPARTMENT` | `ESG` (also the default when unset) | empty: `SINGLE_DEPARTMENT=` |
| Website | `VITE_SINGLE_DEPARTMENT_MODE` | `true` (also the default) | `false` |

In this mode users never see departments or stakeholder types, and every lodge link goes
to the external form.

## How it fits together

```
 Browser (React app on Vercel)
   │  login, own profile, file uploads ──────────────► Supabase (Postgres, Auth, Storage)
   │  everything else (REST) ──► Backend (FastAPI on Render) ──► Supabase (service key)
   │                                │
   │                                ├──► Groq API: triage, chatbot answers, voice
   │                                ├──► Embedding Space (Hugging Face): vectors for policy search
   │                                └──► Brevo: email
```

## Repository layout

```
├── backend/
│   ├── main.py                FastAPI app: every API route, startup, SLA monitor start
│   ├── agent/                 LangGraph chatbot/triage graph (graph.py, nodes/, edges/, llm.py)
│   ├── config/categories.py   Departments, SINGLE_DEPARTMENT, POSH/safety keywords
│   ├── middleware/auth.py     Supabase login check, roles (user / admin / super_admin)
│   ├── utils/                 SLA monitor, notifications, audit log, translation, phone OTP, PDF reports
│   ├── database/              SQL to build the Supabase database (see its README.md)
│   ├── tests/                 pytest suite (offline, with fakes)
│   ├── bootstrap_super_admin.py   One-time script: first super admin and department staff logins
│   └── .env.example           Backend settings, each marked [REQUIRED] or [OPTIONAL]
├── agents/
│   ├── escalation/            Email (Brevo or SMTP) and SMS notifier, escalation agent
│   └── intent/                Intent helper
├── rag/
│   ├── query_data.py          Hybrid policy search, embedding-service client
│   ├── policy_indexer.py      BM25 index, built in memory at startup
│   ├── policy_recommender.py  Policy suggestions attached to complaints
│   ├── rejection_advisor.py   AI check of staff rejection reasons
│   ├── create_database.py     Rebuilds the vector index (see below)
│   ├── okf_schema.py          Policy metadata used when building the index
│   ├── data/okf_policies/     The policy documents (markdown) that are searched
│   ├── data/hr_policies/      Original policy files (PDF / DOCX)
│   └── chroma_final/          Prebuilt vector index (all-MiniLM-L6-v2), committed
├── frontend/                  React 19 + Vite 7 + Bootstrap website
│   ├── src/pages/             One file per page (LodgeExternal, Track, Dashboard, AdminDashboard, ...)
│   ├── src/components/        Navbar, Chatbot, NotificationDropdown, FileUpload, ...
│   ├── src/config/features.js ESG testing mode switch for the website
│   ├── public/locales/        UI text in en / hi / kn
│   ├── vercel.json            Single-page-app rewrite for Vercel
│   └── .env.example           Website settings (all public, built in)
├── deploy/hf-embed-space/     The embedding service (Gradio app for Hugging Face Spaces)
├── render.yaml                Render blueprint for the backend
├── requirements.txt           Python dependencies for the backend (light: no PyTorch)
└── HANDOVER.md                What to host and how, for a new team
```

The other files at the top level (`fetch_admins.py`, `update_fetch.py`, `update_main.py`,
`testgroq.py`, `test_rag.py`, flowchart images, `TEST_EVALUATION_REPORT.md`) are development
scripts and documents; the app does not use them.

## Run it locally from a fresh clone

### 1. What you need

| Tool / account | Version / notes |
|----------------|-----------------|
| Python | **3.11** (the version Render uses: 3.11.11) |
| Node.js | **20.19+ or 22.12+** (needed by Vite 7) |
| Supabase project | Free plan is enough for testing |
| Groq API key | https://console.groq.com |
| Optional | Hugging Face account (embedding Space), Brevo account (email), Twilio (SMS) |

### 2. Database

Create a Supabase project, then follow [backend/database/README.md](backend/database/README.md):
run the SQL files in the listed order in the SQL Editor (including `018_projects_table.sql`),
check row-level security, and set the Auth URLs (`http://localhost:5173` for local work).

### 3. Backend

Run everything from the **repository root** (Python imports `backend`, `agents` and `rag`
as packages).

```bash
python3.11 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp backend/.env.example backend/.env
```

Fill in `backend/.env`. To start you need `SUPABASE_URL`, `SUPABASE_KEY` (anon key),
`SUPABASE_SERVICE_ROLE_KEY`, `GROQ_API_KEY` and `FRONTEND_URL=http://localhost:5173`.
Every other setting is described in the file.

```bash
uvicorn backend.main:app --reload --port 8000
```

Check it: http://localhost:8000/health should return `"status": "healthy"` and, after a few
seconds, `"rag_ready": true`.

**Policy search on your machine:** without `EMBED_URL` the backend uses keyword (BM25)
search only. For full hybrid search either set `EMBED_URL`, `EMBED_KEY` and `HF_TOKEN`
(see [deploy/hf-embed-space/README.md](deploy/hf-embed-space/README.md)), or install the
model locally: `pip install sentence-transformers` (pulls in PyTorch, about 1 GB). The
backend uses a local model first when it finds one.

### 4. First admin accounts

```bash
python backend/bootstrap_super_admin.py
```

With `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD` and `SEED_ADMIN_PASSWORD` set in
`backend/.env`, this creates the super admin and one staff login per department and tier
(L1, L2, L3, HEAD). Remove the three values afterwards. More staff are invited from the
Super Admin page (needs email configured).

### 5. Website

```bash
cd frontend
npm ci
cp .env.example .env               # set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
                                   # VITE_API_BASE_URL=http://localhost:8000
npm run dev
```

Open http://localhost:5173. Other scripts: `npm run build` (output in `frontend/dist`),
`npm run preview`, `npm run lint`.

## Tests

```bash
pip install pytest
python -m pytest backend/tests -q \
  --deselect backend/tests/test_agent.py \
  --deselect backend/tests/test_multiturn_condensation.py
```

These run offline: Supabase, email and the AI are replaced with fakes, so no `.env` or keys
are needed. The two left out call the real Groq API and need `GROQ_API_KEY`;
`test_multiturn_condensation.py` also expects routing to departments other than ESG, so it
fails in ESG testing mode. `evaluate_*.py` and `run_all_metrics.py` in `backend/tests/` are
evaluation scripts, not tests.

## Rebuilding the policy search index

Only needed when the policy documents change. The index is committed, so a normal setup
skips this.

```bash
pip install sentence-transformers pypdf
python rag/create_database.py
```

It reads `rag/data/okf_policies/` (falling back to `rag/data/hr_policies/`), **deletes**
`rag/chroma_final/` and builds it again with `all-MiniLM-L6-v2`, the same model the embedding
Space serves. Commit the new `rag/chroma_final/` afterwards. The BM25 keyword index needs no
rebuild; it is built from the documents each time the backend starts.

## Deployment (current setup)

| Part | Host | Config |
|------|------|--------|
| Website | Vercel | Root directory `frontend`, build `npm run build`, output `dist`, settings from `frontend/.env.example`. `vercel.json` handles page routes. |
| Backend | Render (web service) | [render.yaml](render.yaml): `pip install -r requirements.txt`, `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, health check `/health`, `SINGLE_DEPARTMENT=ESG`. Fits the free 512 MB plan. |
| Embedding service | Hugging Face Space (ZeroGPU) | [deploy/hf-embed-space](deploy/hf-embed-space). The backend needs `EMBED_URL`, `EMBED_KEY` **and** `HF_TOKEN`; without the token, calls fail on the anonymous GPU quota and search silently drops to keywords only. |
| Database, logins, files | Supabase | [backend/database/README.md](backend/database/README.md) |
| Keep-awake | Any cron service | Free Render services sleep after 15 idle minutes; ping `/health` every 10 minutes. |

After changing backend code, check Render deployed the new commit (Render → service → Events).

### Free-plan limits

The free plans are fine for testing, not for production. The first limit reached is the AI:
Groq's free limits for this model (8K tokens/minute, 200K tokens/day) cover only a few
dozen chatbot messages a day, since each message makes about 3 AI calls (~3K tokens). Brevo's
free plan sends 300 emails a day, Supabase's free plan allows 5 GB of data out per month, and
Vercel's Hobby plan is for non-commercial use. Production needs paid plans for these.

## Known limitations

- **Guest mode does not work end to end:** "Continue as Guest" opens the complaint form, but
  the backend needs a login to file, so a guest cannot submit.
- **Bribery questions:** any message mentioning bribery or corruption, including a plain
  question about the Anti-Bribery policy, is treated as a High complaint. purva-main has a
  fix for this that is not in this repo.
- Attachments are stored in a public Supabase bucket: anyone with a file's link can open it
  (they cannot be listed).
- Translation of complaint text uses Google Translate through `deep-translator` and can be
  rate-limited; the UI text itself is static and always works.
- `backend/requirements.txt` is an older, different list. Use the root `requirements.txt`.

## Related repositories

| Repo | What it is |
|------|------------|
| [purva-esg](https://github.com/SmruthiChandrashekar/purva-esg) | This app (ESG only) |
| [purva-main](https://github.com/SmruthiChandrashekar/purva-main) | All-departments variant, deployment copy |
| [minor](https://github.com/SmruthiChandrashekar/minor) | Full research code: local ML models, experiments, paper |
