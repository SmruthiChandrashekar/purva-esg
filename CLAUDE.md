# Rules for Claude Code: GRM portal (purva-main + purva-esg)

Two people work on this project, each with their own Claude Code: **Teja** and **Smruthi** (Smruthi owns both GitHub repos). The goal is that both Claude setups work the same way, every change is recorded in one shared ledger, and nobody overwrites the other's work.

## This repo
This is **purva-esg** (ESG only). The ledger is **not** in this repo: it is `../purva-main/LEDGER.md`. Log ESG changes there.

## The two repos
- **purva-main**: all departments. https://github.com/SmruthiChandrashekar/purva-main
- **purva-esg**: ESG-only copy of the same app. https://github.com/SmruthiChandrashekar/purva-esg
- Same stack in both: React 19 + Vite frontend (`frontend/`, Vercel), FastAPI backend (`backend/`, Render), Supabase, Groq LLM, LangGraph agent, hybrid BM25 + Chroma search.
- They are **separate repos with different histories**. Never merge, rebase or cherry-pick one into the other. Port changes by editing the matching files by hand.
- ESG-only differences to keep: `SINGLE_DEPARTMENT_MODE` (one form, no stakeholder types), the guest complaint form and `/api/guest/complaint`, `apple.css` / `motion.js`, ESG-only backend checks.
- Keep both clones side by side in one folder (e.g. `.../purva-main` and `.../purva-esg` or `.../minor-esg`). Find the other repo next to this one.

## The shared ledger: `purva-main/LEDGER.md`
There is **one** ledger for both repos, and it lives in purva-main. From purva-esg it is `../purva-main/LEDGER.md` (the sibling clone). If that folder is missing, ask the user where purva-main is cloned.

### At the start of every session
1. `git pull --rebase` in **both** repos.
2. Read `LEDGER.md`: the **In progress** table and the newest **Log** entries. Briefly tell the user what the other person changed since the last time and whether anyone is working on something related.
3. If the requested work touches files listed under someone else's **In progress** claim, stop and tell the user before editing.

### Before editing
4. Add a row to **In progress** (who, date, repos, files/area, what), then commit and push it on its own (`chore(ledger): claim <what>`). This tells the other person's Claude what is being worked on. Skip the claim only for a tiny fix that is pushed within minutes.

### When the work is done
5. Add a **Log** entry at the top of the Log, in the format shown in the ledger. Remove your **In progress** row.
6. Commit the ledger update **in the same push** as the work in purva-main. If the work was only in purva-esg, push ESG first, then commit the ledger in purva-main with the ESG commit hash.
7. Fill in the real commit hashes. If you only know them after committing, amend before pushing or add a follow-up ledger commit.
8. Who is "me": use the git user name (`git config user.name`). Teja Chey = **Teja**, SmruthiChandrashekar = **Smruthi**.

### Ledger conflicts
- If `LEDGER.md` conflicts on pull/rebase, **keep both people's entries**: never drop the other person's lines. Order the Log newest first, then continue the rebase.

## Making a change
- **"In both apps"** (the default for UI and bug fixes):
  1. Change purva-main first and run its checks.
  2. Port the change to purva-esg by hand, keeping the ESG-only behaviour, and run the same checks there.
  3. Commit both with the same message, then push both.
  4. Log it once in the ledger with both commit hashes.
- **"Only main" / "only ESG"**: change only that repo, and say so in the ledger entry.
- **Checks:**
  - Frontend: `npm run lint` (don't add new warnings; old ones exist) and `npm run build`.
  - Backend: `pytest` (tests in `backend/tests/`).
- Before committing, show the user a short summary of what changed in each repo.

## Git rules
- Commit and push straight to `main`. No new branches or pull requests unless the user asks.
- Always `git pull --rebase` before pushing. If a push is rejected, pull with rebase, fix conflicts (ask if unsure), rerun checks, and push again. **Never force-push.**
- Commit messages: `type(scope): summary`, for example `fix(nav): ...`, `feat(ui): ...` or `chore(ledger): ...`. **Do not add a "Co-Authored-By: Claude" line.**
- Never commit `.env` files, secrets, `node_modules`, `.venv` or `dist/`.
- Running the backend changes `rag/chroma_final`. Undo that with `git checkout -- rag/chroma_final` before committing.
- Large pushes: `git -c http.postBuffer=524288000 push`.

## Database (Supabase)
- Never change Supabase directly. Write the SQL (as a new numbered file in `backend/database/` when it's a schema change) and give it to the user to run. Note "Supabase SQL to run" under Deploy in the ledger.

## Roles
- 6 departments × L1 / L2 / L3 / HEAD, plus `super_admin`. Don't add other roles.

## Deploys
- Frontends: Vercel, deployed automatically from `main`.
- Backends: Render, deployed from `main`. These often need a **Manual Deploy** in the Render dashboard, so remind the user after backend changes.
- Record what needs redeploying in the ledger entry.

## Writing style
- Write ledger entries, commit messages and explanations in plain language that the other teammate can follow without having been in the session.
