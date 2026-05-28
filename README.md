# ProbeMate Web

![Version](https://img.shields.io/badge/version-v1.1.0-2f7d7e)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.13+-3776AB?logo=python&logoColor=white)
![Tests](https://img.shields.io/badge/tests-pytest%20%7C%20lint%20%7C%20build%20%7C%20playwright-brightgreen)

ProbeMate Web 是一个面向课堂短答诊断的教师端研究原型。它不把 LLM 当作“误概念判分器”，而是把 LLM 限制在候选解释生成层，再由可审计的 diagnostic gate 判断教师下一句话应当 Hold、Ask for Evidence 还是 Diagnostic Probe。

当前发布版本为 `v1.1.0`。本版本完成 `plan.md` 的核心工程链路：真实 provider switch、结构化输出校验、quote audit、Hold / Ask / Probe gate、教师卡片审计字段、研究后台质量指标、实验条件生成、phase manipulation 演示、PostgreSQL 切换、登录/权限与数据治理默认策略。

## Current Status

`v1.1.0` 当前状态：

- Backend package version: `1.1.0`
- Frontend package version: `1.1.0`
- Default AI mode: `AI_PROVIDER=mock`
- Supported AI providers: `mock`, `openai`, `deepseek`
- DeepSeek default model: `deepseek-v4-flash`
- Default storage: local JSON store
- Optional production storage: PostgreSQL via `STORE_BACKEND=postgres`
- Optional access control: teacher/researcher access-code login
- E2E testing: Playwright only, no devtools script
- P0 UX hotfix: global AppShell, breadcrumbs, provider/storage/auth status, and Command Center metrics
- P1 AI transparency: `/settings/ai`, provider smoke test, explicit mock/baseline warnings, card cache controls, and phase demo mock/current provider mode
- P2 Live Classroom workspace: classroom entry projection with QR code, three-column checkpoint dashboard, context switching, response search/filter, and rule-based representative response recommendations
- P3 Study Builder: `/study-builder` generates randomized blind five-condition materials, Study 2 rating templates, and Study 3 timed next-turn records.
- P4 Evidence Console: research dashboard includes provider/condition/downgrade distributions plus over/under-commitment annotation fields.
- P5 Demo data controls: global mode badge, standard demo episode reset, and dev-store clearing from settings.
- Last verified checks: `uv run pytest`, `npm run lint`, `npm run build`, `npm run test:e2e`

## Core Workflow

```text
Teacher creates checkpoint
-> Student submits short answer
-> Teacher selects representative response
-> CandidateGenerator
   -> mock
   -> OpenAI Responses API
   -> DeepSeek JSON chat completions
-> Pydantic schema validation
-> Evidence quote audit
-> Diagnostic gate
-> Teacher card
-> Teacher action
-> Episode log / CSV export
```

关键边界：

- LLM 只输出 `CandidateOutput`，不直接决定最终诊断动作。
- `student_quotes` 必须能在学生原话中找到；引用无效时禁止 Probe。
- 当前活动为同伴讨论、实验观察或教师收束时优先 Hold。
- 证据不足、schema 错误、provider 错误或答案泄露风险高时降级为 Ask/Hold。
- 教师始终可以采用、改写、延后或跳过系统建议。

## Feature Overview

### Teacher

- 创建 checkpoint，设置班级/课次、教学阶段、当前活动和展示策略。
- 使用课堂模板快速建题。
- 在 Live Classroom 首页查看 open/closed checkpoint、模板数和最近课堂。
- 在 checkpoint 工作台内投屏学生入口二维码、复制学生链接、开关提交状态。
- 在工作台内快速切换全班收集、练习追问、同伴讨论、实验观察和收束回看语境。
- 查看学生短答，选择代表回答或录入教师代表回答。
- 搜索/筛选短答，并查看规则聚类给出的代表回答推荐。
- 运行 LLM-backed diagnostic gate。
- 查看证据引用、候选解释、缺失证据、过度诊断风险、安全提示、provider/model/latency 和降级原因。
- 生成 `no_ai`、`standard_llm`、`over_committed`、`evidence_only`、`probemate` 五种实验条件材料。
- 记录 Use / Edit / Delay / Skip 动作和教师反馈。

### Student

- 通过 checkpoint code 进入短答页面。
- 阅读数据用途告知语。
- 使用匿名编号提交或修改短答。
- 自报把握程度。
- checkpoint 关闭后禁止继续提交。
- 学生端不显示误概念标签。

### Research

- 查看 episode logs。
- 按 move、回答来源、教师动作、队列状态、condition 筛选。
- 查看 LLM 运行质量：fallback、schema failure、invalid quote downgrade、bad timing hold、平均延迟等。
- 查看 Real LLM、Mock、Baseline、Evidence-first、Over、Under 指标。
- 按 provider、condition、downgrade reason 查看分布。
- 对 episode 标注 expert preferred move、commitment distance、harmful over/under-commitment、answer leakage、self-correction support。
- 导出 CSV，默认去标识化。
- 查看数据字典。

### Study Builder

- 从已有 episode 生成 `no_ai`、`standard_llm`、`over_committed`、`evidence_only`、`probemate` 五条件材料。
- 自动随机化并盲化为 Assistant A/B/C/D/E。
- 预览每个条件下教师看到的 card、move、provider 和 fallback 状态。
- 导出 `materials.csv`、Study 2 `ratings.csv` 模板、Study 3 `next-turns.csv` 和 `episode_logs.csv`。
- Study 3 timed next-turn 会写回对应 episode log，记录教师下一句话、decision time 和主观负荷。

### Demo

- `/demo/phase-manipulation` 展示同一句短答在不同课堂阶段下的 Ask / Probe / Hold 变化，并可选择 mock 或当前 provider。
- `/ai/provider-status` 展示当前 provider、model 和配置状态。
- `/settings/ai` 展示 provider、model、配置状态、最近一次 AI run，并可运行 smoke test。
- `/settings/ai` 也提供 demo/research/classroom-pilot mode 切换和标准 demo 数据导入。

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript |
| UI | shadcn/ui-style primitives, Base UI, Tailwind CSS, Phosphor Icons |
| Backend | FastAPI, Pydantic |
| AI | mock provider, OpenAI Responses API, DeepSeek OpenAI-compatible chat completions |
| Storage | JSON file store by default; PostgreSQL JSONB repository via `STORE_BACKEND=postgres` |
| Testing | pytest, ESLint, Next build, Playwright |

## Directory Map

```text
web-app/
  api/
    app/
      api/routes.py
      prompts/candidate_generation_v0_1.md
      repositories/
        base.py
        json_store.py
        postgres_store.py
      schemas/models.py
      services/
        auth.py
        candidate_generators.py
        evidence_audit.py
        experimental.py
        governance.py
        llm_client.py
        pipeline.py
        store.py
        export.py
        data_dictionary.py
    scripts/import_json_store_to_postgres.py
    tests/
  frontend/
    app/
      page.tsx
      login/page.tsx
      demo/phase-manipulation/page.tsx
      settings/ai/page.tsx
      teacher/page.tsx
      teacher/checkpoints/[id]/page.tsx
      s/[checkpointCode]/page.tsx
      research/page.tsx
      study-builder/page.tsx
    lib/api.ts
    lib/types.ts
    scripts/playwright-flow-test.cjs
  scripts/
    run-api-mock.ps1
    run-api-deepseek.ps1
    run-api-openai.ps1
  shared/
  .env.example
  plan.md
```

## Environment

Copy the example file:

```powershell
Copy-Item .env.example .env
```

Important variables:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000

AI_PROVIDER=mock
AI_MODEL=
AI_TIMEOUT_SECONDS=4.5
AI_TEMPERATURE=0.2

OPENAI_API_KEY=

DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com

STORE_BACKEND=json
DATABASE_URL=
PROBEMATE_STORE_PATH=

DATA_RETENTION_DAYS=180
PROBEMATE_MODE=demo
AUTH_SECRET=
TEACHER_ACCESS_CODE=
RESEARCH_ACCESS_CODE=
```

The API loads environment variables from both `web-app/.env` and `web-app/api/.env` with `override=false`. Existing shell variables win, which lets the run scripts force a provider without rewriting `.env`.

Provider modes:

- `AI_PROVIDER=mock`: deterministic local candidate generator for development and tests.
- `AI_PROVIDER=openai`: uses `OPENAI_API_KEY` and `AI_MODEL`.
- `AI_PROVIDER=deepseek`: uses `DEEPSEEK_API_KEY`; defaults to `deepseek-v4-flash` unless `AI_MODEL` or `DEEPSEEK_MODEL` is set.

Auth modes:

- If `TEACHER_ACCESS_CODE` and `RESEARCH_ACCESS_CODE` are empty, local development routes stay open.
- If either access code is set, teacher/research routes require a Bearer token from `POST /auth/login`.
- Student code entry remains anonymous. Teacher representative responses require teacher/researcher auth when auth is enabled.

## Local Run

Install frontend dependencies once:

```powershell
cd frontend
npm install
```

Start the API:

```powershell
cd api
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Provider-specific API scripts:

```powershell
.\scripts\run-api-mock.ps1
.\scripts\run-api-deepseek.ps1
.\scripts\run-api-openai.ps1
```

For real providers, set the key in the shell or `.env` before using the script:

```powershell
$env:DEEPSEEK_API_KEY="..."
$env:AI_MODEL="deepseek-v4-flash"
.\scripts\run-api-deepseek.ps1
```

Start the frontend:

```powershell
cd frontend
npm run dev
```

Common pages:

```text
http://localhost:3000/
http://localhost:3000/login
http://localhost:3000/teacher
http://localhost:3000/research
http://localhost:3000/demo/phase-manipulation
http://localhost:3000/settings/ai
http://localhost:3000/s/{checkpointCode}
```

If the API uses another port, set the frontend API base before building or running:

```powershell
$env:NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8001"
```

## API Surface

### System

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | access-code login for teacher or researcher |
| GET | `/ai/provider-status` | provider/model/configured status |
| POST | `/ai/provider-smoke-test` | run current provider through candidate generation, quote audit, and gate |
| GET | `/system/status` | command center provider/storage/auth/run counts |
| PATCH | `/system/mode` | switch demo/research/classroom-pilot mode |
| POST | `/system/demo-data/reset` | reset local store to standard demo episodes |
| POST | `/system/demo-data/clear` | clear local dev store |
| GET | `/data-governance` | student notice and retention policy |

### Checkpoints and Responses

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/checkpoints` | list checkpoints |
| POST | `/checkpoints` | create checkpoint |
| GET | `/checkpoints/{checkpoint_id}` | read checkpoint |
| PATCH | `/checkpoints/{checkpoint_id}` | update status, phase, activity or visibility |
| GET | `/checkpoints/code/{code}` | student code lookup |
| GET | `/checkpoint-templates` | built-in templates |
| GET | `/checkpoints/{checkpoint_id}/responses` | list responses |
| POST | `/checkpoints/{checkpoint_id}/responses` | create student or teacher representative response |
| PATCH | `/responses/{response_id}` | update response or representative state |
| POST | `/responses/{response_id}/analyze` | run diagnostic gate |
| POST | `/responses/{response_id}/analyze?rerun=true` | force rerun |
| DELETE | `/responses/{response_id}/analysis-cache` | clear cached card for the current response revision |
| POST | `/study-builder/materials` | generate blind condition materials for a response |
| POST | `/study-builder/next-turns` | record Study 3 timed teacher next-turn for a generated material |

### Experiment and Research

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/experimental/generate-condition` | generate baseline or ProbeMate study material |
| POST | `/demo/phase-manipulation` | return Ask / Probe / Hold demonstration output |
| POST | `/teacher-actions` | record Use / Edit / Delay / Skip |
| GET | `/research/episode-logs` | query episode logs |
| GET | `/research/evidence-summary` | aggregate evidence-console metrics |
| PATCH | `/research/episode-logs/{log_id}/annotation` | update expert over/under annotations |
| GET | `/research/episode-logs.csv` | export CSV |
| GET | `/research/data-dictionary` | field dictionary |

## Research Data

`EpisodeLog` records:

- checkpoint, response, revision and class/session metadata.
- provider, model, prompt version, schema version and latency.
- raw LLM validity, validation error, provider error and fallback state.
- quote/gate reasons, downgrade reason and blocked actions.
- teacher action, edit distance proxy, decision time and queue state.
- Study 3 timed next-turn text, perceived load and study notes.
- experimental condition.

CSV export defaults to `deidentify=true`. It hashes IDs and class/session names, and redacts potentially identifying free text such as student answers, final teacher turns, teacher feedback and queue notes.

For local debugging only:

```text
/research/episode-logs.csv?deidentify=false
```

## Storage

Default local storage:

```text
api/data/dev-store.json
```

Override JSON path:

```powershell
$env:PROBEMATE_STORE_PATH="D:\tmp\probemate-store.json"
```

Use PostgreSQL:

```powershell
$env:STORE_BACKEND="postgres"
$env:DATABASE_URL="postgresql://user:password@localhost:5432/probemate"
```

Import an existing JSON store:

```powershell
cd api
uv run python scripts/import_json_store_to_postgres.py --database-url $env:DATABASE_URL --json-store data/dev-store.json
```

The current PostgreSQL implementation uses the same repository interface as the JSON store and stores the validated application payload in a JSONB row. That keeps the research export stable while allowing deployment environments to move off local files.

## Tests

Backend:

```powershell
cd api
uv run pytest
```

Frontend lint:

```powershell
cd frontend
npm run lint
```

Frontend production build:

```powershell
cd frontend
npm run build
```

End-to-end Playwright flow:

```powershell
cd frontend
npm run test:e2e
```

For non-default ports:

```powershell
$env:PLAYWRIGHT_APP_BASE="http://127.0.0.1:3015"
$env:PLAYWRIGHT_API_BASE="http://127.0.0.1:8015"
npm run test:e2e
```

The E2E script uses Playwright only. It covers provider status, teacher analysis, over-committed condition generation, phase manipulation Ask / Probe / Hold, and research dashboard rendering.

## Development Rules

- Keep `frontend/lib/types.ts` aligned with `api/app/schemas/models.py`.
- Any new research field must be reflected in `EpisodeLog`, `export.py`, `data_dictionary.py`, frontend types, and research UI.
- Keep `AI_PROVIDER=mock` working for deterministic local demos and tests.
- Do not commit real API keys. Use environment variables only.
- Keep student-facing pages free of misconception labels.

## Deployment Notes

For a classroom pilot, set:

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=
TEACHER_ACCESS_CODE=
RESEARCH_ACCESS_CODE=
AUTH_SECRET=
STORE_BACKEND=postgres
DATABASE_URL=
DATA_RETENTION_DAYS=180
```

Production deployments should also confirm IRB/ethics approval, data retention scope, who can view raw answers, export handling, and model/provider logging requirements.
