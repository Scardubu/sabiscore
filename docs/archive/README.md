# Archive

Point-in-time status, deployment-summary, and superseded planning documents
from past work sessions. Moved here on 2026-06-28 to keep the repository
root focused on living documentation.

**None of these are authoritative.** Repository code overrides all of them.
The current sources of truth are, at the repository root:

- `README.md` — overview and quick start
- `CLAUDE.md` — project constraints and governance
- `NEXUS.md` — skill orchestration
- `CHANGELOG.md` — active changelog

and in `docs/`:

- `docs/SABISCORE_PRODUCTION_SETUP_GUIDE.md` — the authoritative setup,
  deployment, and operations guide
- `docs/ARCHITECTURE.md`, `docs/API.md`, `docs/DEPLOYMENT_GUIDE.md`,
  `docs/ESPN_PROVIDER_INTEGRATION.md`, `docs/CORE_ENGINE.md`

Many of the files in this folder describe an earlier, since-replaced
architecture (browser TensorFlow.js inference, a `frontend/` Vite app,
different ports, different deploy targets). They are retained for history
only.

`requirements.root.txt.orphaned` was a root-level `requirements.txt` not
referenced by any Dockerfile, CI workflow, or script (`backend/Dockerfile`
and `apps/ws/Dockerfile` each `COPY` their own local `requirements.txt`
relative to their own build context). The canonical backend dependency file
is `backend/requirements.txt`.
