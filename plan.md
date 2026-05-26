# ProbeMate Web 软件开发计划

版本：v1.1-v1.5 开发计划  
基线：`web-app` 当前 v1.0.0 工程  
范围：仅覆盖 Web 端，包括 `api`、`frontend`、`shared` 和本地开发配置  
原则：保留现有需求，不用历史旧稿覆盖当前最新版方案

## 1. 当前基线判断

ProbeMate Web v1.0.0 已经完成课堂 checkpoint、学生短答、教师代表回答、Hold / Ask / Probe 诊断闸门、教师动作记录、研究日志和 CSV 导出。当前系统已经是一个可运行的研究型 workflow demo。

但 v1.0.0 还没有真正接入 LLM。后端 `api/app/services/pipeline.py` 里目前使用 `mock_candidate_generator()`，通过关键词模拟候选解释；`api/pyproject.toml` 也还没有大模型 SDK 依赖。也就是说，当前版本更准确的定位是：

> v1.0.0 是 ProbeMate 的 research workflow demo，不是完整 AI capability demo。

下一阶段不能盲目堆页面、账号、数据库或大屏。最优先的工程目标是把 mock diagnostic gate 升级为可审计的 LLM-backed diagnostic gate，同时保留规则化 gate 对 Hold / Ask / Probe 的最终控制。

## 2. 已有工程资产

### 2.1 后端资产

| 文件 | 当前职责 | 后续开发关系 |
| --- | --- | --- |
| `api/app/main.py` | FastAPI app 入口 | 保持稳定 |
| `api/app/api/routes.py` | REST routes | 增加 AI provider、实验条件、演示接口 |
| `api/app/schemas/models.py` | Pydantic schema 和 enum | 增加 LLM 元数据、验证错误、降级原因、实验条件 |
| `api/app/services/pipeline.py` | input pack、mock generator、gate decision、analysis 保存 | 拆分 CandidateGenerator，接入 LLM，并保留 gate |
| `api/app/services/store.py` | JSON file store | 扩展字段；v1.4 再迁移数据库 |
| `api/app/services/export.py` | CSV 导出 | 增加新研究字段 |
| `api/app/services/data_dictionary.py` | 数据字典 | 每次新增导出字段必须同步 |
| `api/app/services/templates.py` | checkpoint 模板 | 可补更多研究展示模板 |
| `api/tests` | API 测试 | 扩充 LLM provider、gate、导出和实验条件测试 |

### 2.2 前端资产

| 文件 | 当前职责 | 后续开发关系 |
| --- | --- | --- |
| `frontend/app/page.tsx` | 首页入口 | v1.3 增加系统流程图和 provider 状态 |
| `frontend/app/teacher/page.tsx` | checkpoint 创建和列表 | 增加 provider 标识、模板说明、创建体验优化 |
| `frontend/app/teacher/checkpoints/[id]/page.tsx` | 教师 dashboard、短答、分析卡片、动作记录 | v1.1-v1.3 的主战场 |
| `frontend/app/s/[checkpointCode]/page.tsx` | 学生短答提交 | 增加学生告知语、匿名规则、关闭态优化 |
| `frontend/app/research/page.tsx` | episode log、筛选、CSV、数据字典 | 增加 AI 运行质量指标 |
| `frontend/lib/api.ts` | 前端 API client | 增加新 endpoint 封装 |
| `frontend/lib/types.ts` | TypeScript 类型 | 与 Pydantic schema 同步 |
| `frontend/components/ui` | shadcn/ui 风格基础组件 | 继续复用，不引入另一套 UI 系统 |
| `frontend/scripts/devtools-flow-test.cjs` | 端到端流程脚本 | 增加 LLM mock/openai 双模式和实验页面检查 |

### 2.3 当前可复用设计

已有设计可以继续保留：

- `InputPack` 已经包含 `question`、`student_answer`、`target_concept`、`lesson_phase`、`current_activity`、`visibility_policy` 和 `prior_context`。
- `CandidateOutput` 已经有候选解释、证据状态、可区分性、建议教师动作和 safety notes。
- `decide_gate()` 已经体现核心论文逻辑：时机不合适则 Hold，证据不足则 Ask，证据充分且时机合适才 Probe。
- `EpisodeLog` 已经能把 checkpoint、response、card、teacher action 串起来。
- 教师端已经有 Use / Edit / Delay / Skip 四类动作。
- 研究后台已经支持筛选、分页、CSV 和数据字典。

## 3. 产品与研究目标

ProbeMate 不应被实现成“LLM 直接判断学生误概念”的系统。它应被实现成“教师下一句话之前的诊断闸门”。

核心目标：

1. 真实 LLM 只生成候选解释、证据缺口和可选话术。
2. 系统必须要求候选解释绑定学生原话。
3. 系统必须审计 LLM 输出是否可被学生原话支持。
4. 最终 Hold / Ask / Probe 由规则化 diagnostic gate 决定。
5. 证据不足时系统最多建议追证据，不直接诊断。
6. 当前课堂活动不适合插入时，即使有线索也应 Hold。
7. 教师始终保留采用、改写、延后、跳过的控制权。
8. 研究后台必须能复盘 provider、model、prompt、schema、latency、validation 和 downgrade reason。

## 4. 需求保全表

下表把原稿中的需求全部保留下来，并转成工程条目。

| 原需求 | 工程化落点 | 计划版本 |
| --- | --- | --- |
| 接入真实 LLM | `CandidateGenerator` provider 层、OpenAI provider、环境变量开关 | v1.1 |
| 不让 LLM 直接给最终诊断 | LLM 只输出 `CandidateOutput`，最终 move 由 `decide_gate()` 决定 | v1.1 |
| 使用结构化 JSON 输出 | `CandidateOutput` schema 校验、raw output validation、失败降级 | v1.1 |
| 候选解释必须绑定学生原话 | quote audit，quote 不存在则禁止 Probe | v1.1 |
| 保留 Hold / Ask / Probe 规则 gate | 继续维护 `decide_gate()`，只替换输入来源 | v1.1 |
| 教师卡片新增 evidence、candidate、safety 等字段 | 扩展 `TeacherCardPanel` 和 `TeacherCard` 类型 | v1.1 |
| 研究日志新增 provider/model/prompt/schema/validation/downgrade 字段 | 扩展 `EpisodeLog`、CSV、数据字典 | v1.1 |
| 支持 baseline 条件生成 | 新增实验条件 generator endpoint 和前端入口 | v1.2 |
| 支持 No-AI / Standard LLM / Over-committed / Evidence-only / ProbeMate | 新增 `ExperimentCondition` enum 与服务层 | v1.2 |
| 增加 phase manipulation 演示页 | 新增页面展示同一句短答在不同阶段下的 move 变化 | v1.2 |
| 教师 dashboard 改成三栏 | 改造 checkpoint 详情页布局 | v1.3 |
| 首页增加系统流程图 | 改造 `frontend/app/page.tsx` | v1.3 |
| 研究后台增加诊断质量概览 | 增加质量指标和筛选项 | v1.3 |
| 接入 PostgreSQL / Supabase | 抽象 repository，替换 JSON store | v1.4 |
| 真实课堂部署前补账号、班级、匿名、留存、安全、告知 | 权限、数据治理和部署安全 | v1.5 |
| 保留 mock fallback | `AI_PROVIDER=mock` 永远可用 | v1.1-v1.5 |
| 支持演示脚本 | 提供固定 checkpoint、短答、阶段切换和输出路径 | v1.2-v1.3 |

## 5. 总体架构目标

目标架构：

```text
Teacher creates checkpoint
  -> Student submits short answers
  -> Teacher selects representative answer
  -> Build InputPack
  -> CandidateGenerator
       -> MockCandidateGenerator
       -> LLMCandidateGenerator
  -> Structured schema validation
  -> Evidence audit
  -> Diagnostic gate
       -> Hold
       -> Ask for Evidence
       -> Diagnostic Probe
  -> Teacher card
  -> Teacher action
       -> Use
       -> Edit then use
       -> Delay
       -> Skip
  -> Episode log
  -> Research dashboard / CSV export
```

关键边界：

- `CandidateGenerator` 可以换 provider。
- `decide_gate()` 不依赖具体 provider。
- `EpisodeLog` 必须记录 AI 运行和 gate 决策的完整审计信息。
- 前端只展示经过后端校验和 gate 处理后的结果。

## 6. v1.1 开发计划：真实 LLM-backed diagnostic gate

### 6.1 目标

把 `mock_candidate_generator()` 从唯一实现改成可切换 provider。v1.1 的交付标准不是“LLM 能返回一段话”，而是：

1. LLM 返回结构化候选解释。
2. 后端校验 schema。
3. 后端校验引用是否来自学生原话。
4. gate 根据证据和课堂时机决定 Hold / Ask / Probe。
5. 教师端看到可审计卡片。
6. 研究后台能区分 mock 输出、LLM 输出、规则降级输出和失败降级输出。

### 6.2 后端模块拆分

在 `api/app/services/pipeline.py` 基础上拆分：

```text
api/app/services/
  pipeline.py              # analyze_student_response orchestration
  candidate_generators.py  # provider interface and implementations
  evidence_audit.py        # quote validation and downgrade helpers
  llm_client.py            # provider-specific API client wrapper
```

建议接口：

```python
class CandidateGenerator(Protocol):
    def generate(self, input_pack: InputPack) -> CandidateGenerationResult:
        ...
```

新增模型：

```python
class CandidateGenerationResult(BaseModel):
    candidate_output: CandidateOutput | None
    ai_provider: str
    model_name: str | None = None
    prompt_version: str
    schema_version: str
    raw_llm_valid: bool = True
    validation_error: str | None = None
    provider_error: str | None = None
    fallback_used: bool = False
```

保留：

- `MockCandidateGenerator` 用于本地演示、测试和无 key 环境。
- `LLMCandidateGenerator` 用于真实 provider。
- `decide_gate()` 继续作为规则 gate。

### 6.3 环境变量

扩展 `.env.example`：

```env
AI_PROVIDER=mock
AI_MODEL=
AI_TIMEOUT_SECONDS=4.5
AI_TEMPERATURE=0.2
OPENAI_API_KEY=
```

说明：

- `AI_PROVIDER=mock`：完全复用当前 mock 逻辑。
- `AI_PROVIDER=openai`：调用真实 LLM。
- `AI_MODEL` 不在代码里硬编码，避免模型升级时改业务代码。
- provider 超时、schema 错误或网络错误时，必须有 fallback 策略。

### 6.4 结构化输出 schema

LLM 输出必须严格符合 `CandidateOutput`，不能让模型自由返回一段自然语言。

目标结构：

```json
{
  "candidate_explanations": [
    {
      "label": "possible_velocity_acceleration_confusion",
      "student_quotes": ["还在往前走"],
      "interpretation": "学生可能把运动方向当作加速度方向，也可能只是没有表达速度变化量。",
      "missing_evidence": "尚未说明速度变化量方向。",
      "risk_if_overdiagnosed": "可能把表达不完整误判为稳定误概念。"
    }
  ],
  "evidence_state": "ambiguous",
  "distinguishability": "needs_representation",
  "suggested_teacher_moves": [
    {
      "move_type_hint": "ask_for_evidence",
      "text": "请画出此刻速度箭头和下一秒速度箭头，比较速度变化量方向。",
      "answer_leakage_risk": "low"
    }
  ],
  "safety_notes": [
    "不要直接说学生混淆速度和加速度。"
  ]
}
```

约束：

- `candidate_explanations` 至少 1 个。
- 每个 candidate 必须有 `student_quotes`。
- `student_quotes` 必须能在 `InputPack.student_answer` 中找到。
- `suggested_teacher_moves` 至少 1 个。
- `move_type_hint` 只能是 `hold`、`ask_for_evidence`、`diagnostic_probe`。
- `answer_leakage_risk` 需要保留，后续可参与降级。

### 6.5 Evidence audit

新增 quote audit：

```text
if no valid quote:
    downgrade_reason = no_valid_quote
    final move = Ask for Evidence
```

有效 quote 判定：

1. quote 非空。
2. quote 是学生回答中的原始连续片段，或通过保守 normalize 后仍可匹配。
3. quote 不得引用问题文本、教师提示或模型自行补写内容。

无效 quote 例子：

```text
学生回答：向前
LLM 引用：还在往前走
结果：invalid quote，禁止 Diagnostic Probe
```

### 6.6 Diagnostic gate 规则

保留当前 `decide_gate()` 的核心顺序：

```text
if current_activity in bad_timing:
    move = Hold
    downgrade_reason = bad_timing

elif no valid quote:
    move = Ask for Evidence
    downgrade_reason = no_valid_quote

elif evidence_state in ["none", "ambiguous"]:
    move = Ask for Evidence
    downgrade_reason = evidence_ambiguous

elif answer_leakage_risk is high:
    move = Ask for Evidence
    downgrade_reason = answer_leakage_risk

else:
    move = Diagnostic Probe
```

现有 bad timing 活动继续保留：

- `peer_discussion`
- `experiment_observation`
- `teacher_wrap_up`

### 6.7 失败降级策略

LLM 接入后必须处理失败路径：

| 失败类型 | 处理策略 | episode 字段 |
| --- | --- | --- |
| provider timeout | fallback 到 mock 或 Ask | `provider_error=timeout` |
| schema validation failed | 不使用 LLM 输出，降级 Ask | `validation_error` |
| no valid quote | 禁止 Probe，降级 Ask | `downgrade_reason=no_valid_quote` |
| evidence ambiguous | 降级 Ask | `downgrade_reason=evidence_ambiguous` |
| bad timing | Hold | `downgrade_reason=bad_timing` |
| high answer leakage risk | 降级 Ask | `downgrade_reason=answer_leakage_risk` |

### 6.8 数据模型变更

扩展 `EpisodeLog`：

```python
ai_provider: str = "mock"
model_name: str | None = None
raw_llm_valid: bool = True
validation_error: str | None = None
provider_error: str | None = None
downgrade_reason: str | None = None
fallback_used: bool = False
```

扩展 `AnalyzeResponseResult`：

```python
ai_run_id: str
card: TeacherCard
latency_ms: int
cached: bool
ai_provider: str
model_name: str | None
raw_llm_valid: bool
fallback_used: bool
```

如果不想污染前端卡片类型，也可以把 provider 元数据放入 `TeacherCard.metadata`，但研究导出层必须可见。

### 6.9 API 变更

新增：

```text
GET /ai/provider-status
```

返回：

```json
{
  "ai_provider": "mock",
  "model_name": null,
  "configured": true,
  "fallback_available": true
}
```

保留：

```text
POST /responses/{response_id}/analyze
POST /responses/{response_id}/analyze?rerun=true
```

分析接口返回体增加 provider 和 validation 信息。

### 6.10 教师端 UI 变更

当前 `TeacherCardPanel` 已展示：

- Move
- Why this move
- Teacher move
- 内部依据
- Use / Edit / Delay / Skip

v1.1 增加：

```text
Evidence quotes
Candidate explanations
Missing evidence
Risk if overdiagnosed
Safety notes
Provider / model / latency
Downgrade reason
Validation state
```

教师卡片展示模板：

```text
Move:
Ask for Evidence

Why this move:
学生说“还在往前走”，可能关注运动方向，但尚未表达速度变化量方向。

Evidence quotes:
“还在往前走”

Candidate explanations:
1. 可能混淆速度方向和加速度方向
2. 也可能只是表达不完整
3. 证据不足，需画图确认

Teacher move:
请画出此刻速度箭头和下一秒速度箭头，比较速度变化量方向。

Safety note:
不要直接说“你混淆了速度和加速度”。
```

UI 要求：

- 继续使用 shadcn/ui 风格组件。
- 继续使用 Phosphor Icons 或后续统一 icon 库，不混用多套视觉语言。
- provider、model、latency 作为小型技术元信息，不抢占教师主要注意力。
- `downgrade_reason` 应以“为什么没有更强诊断”的方式展示，避免让教师误解为错误。

### 6.11 研究后台变更

`frontend/app/research/page.tsx` 增加字段列和筛选：

- AI provider
- Model
- Raw LLM valid
- Validation error
- Provider error
- Downgrade reason
- Fallback used
- Prompt version
- Schema version

CSV 和数据字典同步增加这些字段。

### 6.12 v1.1 验收标准

功能验收：

1. `AI_PROVIDER=mock` 时，现有流程不退化。
2. `AI_PROVIDER=openai` 且配置有效时，后端调用真实 LLM 生成候选解释。
3. LLM 输出不符合 schema 时，系统不崩溃，episode 记录 validation error。
4. LLM 引用不存在的学生原话时，系统禁止 Probe 并降级 Ask。
5. 当前活动为同伴讨论、实验观察或教师收束时，系统输出 Hold。
6. 教师端能看到 evidence、candidate、missing evidence、safety notes 和 provider 信息。
7. 研究后台和 CSV 能区分 mock、openai、fallback、validation failed、downgrade reason。

测试验收：

```powershell
cd api
uv run pytest
```

```powershell
cd frontend
npm run lint
npm run build
```

端到端脚本需增加：

- mock provider flow
- LLM schema failure mocked flow
- invalid quote downgrade flow
- bad timing Hold flow
- research CSV 新字段检查

## 7. v1.2 开发计划：研究实验模式

### 7.1 目标

把系统从 classroom workflow demo 扩展成可生成 Study 2 / Study 3 材料的研究工具。重点不是给真实课堂增加复杂功能，而是支持同一 episode 在不同系统条件下的材料生成。

### 7.2 Baseline 条件

新增条件：

```text
no_ai
standard_llm
over_committed
evidence_only
probemate
```

含义：

| condition | 输出逻辑 |
| --- | --- |
| `no_ai` | 不给 AI 建议，记录教师独立下一句话 |
| `standard_llm` | 普通 LLM 生成一个教师追问，不做证据闸门 |
| `over_committed` | 故意给出过强诊断式建议，用于实验对照 |
| `evidence_only` | 只建议补证据，不给诊断候选 |
| `probemate` | 走完整 CandidateOutput + Evidence audit + Diagnostic gate |

### 7.3 后端 endpoint

新增：

```text
POST /experimental/generate-condition
```

输入：

```json
{
  "response_id": "resp_xxx",
  "condition": "probemate"
}
```

输出示例：

```json
{
  "condition": "standard_llm",
  "teacher_card": "你能再解释一下速度和加速度有什么区别吗？"
}
```

```json
{
  "condition": "over_committed",
  "teacher_card": "学生混淆了速度和加速度。请追问为什么减速时加速度方向与运动方向相反。"
}
```

```json
{
  "condition": "evidence_only",
  "teacher_card": "请先让学生画出此刻速度箭头和下一秒速度箭头。"
}
```

```json
{
  "condition": "probemate",
  "move": "ask_for_evidence",
  "teacher_card": "请画出此刻速度箭头和下一秒速度箭头，比较速度变化量方向。"
}
```

### 7.4 Phase manipulation 演示页

新增页面建议：

```text
frontend/app/demo/phase-manipulation/page.tsx
```

页面目标：

同一句学生回答：

```text
向前，因为车还在往前走。
```

切换教学阶段和当前活动：

```text
刚引入
练习后
小组互评中
```

系统输出：

```text
刚引入 -> Ask for Evidence
练习后 -> Diagnostic Probe
小组互评中 -> Hold
```

研究意义：

这个页面直接展示 ProbeMate 的核心观点：合适承诺不是 answer classification，而是 context-sensitive action。

### 7.5 数据记录

`EpisodeLog.condition` 当前固定为 `ProbeMate`。v1.2 要改为真实条件：

```text
no_ai
standard_llm
over_committed
evidence_only
probemate
```

研究后台新增 condition 筛选。

### 7.6 v1.2 验收标准

1. 同一 response 可以生成不同 condition 的材料。
2. `probemate` 条件继续走完整 gate。
3. `standard_llm` 和 `over_committed` 不覆盖 ProbeMate 的 episode log。
4. 研究后台能按 condition 筛选和导出。
5. phase manipulation 页面能稳定展示 Ask / Probe / Hold 的变化。

## 8. v1.3 开发计划：展示质量和教师工作台

### 8.1 目标

让 demo 从“能跑”变成“看起来就是一个完整研究系统”。v1.3 不改变核心 AI 逻辑，主要提升教师端可用性和研究后台可解释性。

### 8.2 教师 dashboard 三栏布局

改造 `frontend/app/teacher/checkpoints/[id]/page.tsx`：

```text
左栏：本 checkpoint 的学生短答
中栏：代表性回答 / 待分析回答 / 当前课堂上下文
右栏：ProbeMate 诊断卡片
```

左栏显示：

- 学生短答
- 匿名编号
- 把握程度
- 回答来源
- 是否已被选为代表回答
- 是否已分析
- 回答修订版本

中栏显示：

- 当前代表回答
- 回答来源：学生扫码 / 教师代表输入 / imported episode
- 当前教学阶段
- 当前活动
- 展示策略
- checkpoint 状态
- 学生入口链接

右栏显示：

- Move
- Why this move
- Evidence quotes
- Candidate explanations
- Missing evidence
- Risk if overdiagnosed
- Safety notes
- Teacher move
- Provider / model / latency
- Use / Edit / Delay / Skip

### 8.3 首页系统流程图

改造 `frontend/app/page.tsx`，增加横向流程：

```text
Create checkpoint
-> Student answers
-> Select representative answer
-> LLM candidate explanations
-> Evidence audit
-> Diagnostic gate
-> Teacher action
-> Episode log
```

要求：

- 首页仍然直接进入教师端和研究后台，不做营销页。
- 系统流程图用于让导师快速理解系统不是普通问答工具。
- 保持当前简洁风格，不引入大面积装饰。

### 8.4 研究后台诊断质量概览

改造 `frontend/app/research/page.tsx`，新增指标：

```text
Over-diagnosis blocked:
无引用而被降级的次数

Bad timing protected:
因课堂时机不合适而 Hold 的次数

Evidence-first actions:
Ask for Evidence 占比

Teacher agency:
Edit / Delay / Skip 占比

LLM failures:
schema error / timeout / no quote 次数

Average latency:
平均 LLM / gate 延迟
```

后端可先在前端按当前 page logs 聚合，后续再增加汇总 endpoint：

```text
GET /research/summary
```

### 8.5 v1.3 验收标准

1. 教师端三栏在桌面端信息密度更高，在移动端不重叠。
2. 首页能解释完整系统流程。
3. 研究后台有质量指标，不只是总 episode 数。
4. 所有 UI 继续使用 shadcn/ui 风格组件和统一 icon。
5. Playwright/devtools 流程截图确认无明显布局错位。

## 9. v1.4 开发计划：真实数据库

### 9.1 目标

在 LLM 接入和研究模式稳定后，将当前 JSON file store 替换为 PostgreSQL 或 Supabase。不要在 v1.1 前优先做数据库迁移，因为 AI 逻辑没有稳定前，数据结构还会频繁变化。

推荐顺序：

```text
v1.1 真实 LLM
v1.2 实验条件生成
v1.3 dashboard 展示优化
v1.4 PostgreSQL / Supabase
v1.5 权限、班级、正式部署
```

### 9.2 Repository 抽象

新增：

```text
api/app/repositories/
  base.py
  json_store.py
  postgres_store.py
```

保留现有 JSON store 作为本地开发实现。

### 9.3 数据表建议

```text
checkpoints
student_responses
teacher_cards
teacher_actions
episode_logs
ai_runs
experimental_conditions
```

其中 `ai_runs` 独立出来后记录：

- provider
- model
- prompt_version
- schema_version
- latency_ms
- raw_llm_valid
- validation_error
- provider_error
- fallback_used
- created_at

### 9.4 v1.4 验收标准

1. JSON store 和 PostgreSQL/Supabase store 通过同一套 repository interface。
2. 本地测试默认仍可使用 JSON store。
3. 生产环境可通过环境变量切换数据库。
4. episode log 导出结果与 v1.3 保持兼容。
5. 数据迁移脚本能从 `api/data/dev-store.json` 导入基础数据。

## 10. v1.5 开发计划：真实课堂部署准备

真实课堂部署前必须补齐：

1. 教师登录。
2. 班级和 checkpoint 管理。
3. 学生匿名 ID 规则。
4. 数据保留周期。
5. 导出前二次去标识化。
6. prompt / model / schema 版本记录。
7. 网络失败时 fallback。
8. LLM 输出安全审计。
9. 学生端告知语。
10. 教师端“不公开误概念标签”的默认策略。

这些是进入真实课堂之前必须做的，但不是当前第一步。当前第一步仍然是让系统真正有 LLM-backed diagnostic gate。

### 10.1 权限与账号

最低可行方案：

- 教师账号登录。
- checkpoint 归属教师。
- 研究后台只对授权研究者开放。
- 学生端仍保持匿名 code 入口。

### 10.2 数据治理

必须明确：

- 采集哪些字段。
- 哪些字段可能含 PII。
- 数据保留多久。
- 导出前如何去标识化。
- 谁可以查看原始回答。
- 学生端如何告知用途。

### 10.3 安全默认策略

默认策略：

- 学生端不显示误概念标签。
- 教师端不默认公开系统诊断。
- 公开展示只能使用匿名代表回答。
- LLM 输出不得直接作为学生评价或成绩依据。

## 11. 建议 GitHub Issues

### Issue 1：Add AI provider switch

目标：

```text
AI_PROVIDER=mock | openai
```

验收标准：

```text
mock 模式保持原逻辑；
openai 模式调用真实 LLM；
页面显示当前 provider；
provider 失败时不影响课堂流程。
```

### Issue 2：Implement LLMCandidateGenerator

目标：替换 `mock_candidate_generator()` 的可选实现。

输入：

```text
question
student_answer
target_concept
lesson_phase
current_activity
visibility_policy
prior_context
```

输出：严格符合 `CandidateOutput` schema。

### Issue 3：Structured output schema validation

目标：LLM 输出必须被 Pydantic 校验。

失败时：

```text
schema_validation_failed -> Ask for Evidence 或 Hold
```

同时记录：

```text
raw_llm_valid=false
validation_error=...
downgrade_reason=schema_validation_failed
```

### Issue 4：Quote-required evidence audit

目标：每个候选解释必须有 `student_quotes`。

规则：

```text
quote 不在 student_answer 中 -> 禁止 Diagnostic Probe
```

验收标准：

```text
学生回答：“向前”
LLM 如果引用“还在往前走”，系统判定 invalid quote，并降级。
```

### Issue 5：Add downgrade reason to episode log

新增字段：

```text
downgrade_reason
blocked_actions
validation_error
provider_error
fallback_used
```

这对论文非常关键，因为它能证明系统不是“少说”，而是在证据或时机不足时降级。

### Issue 6：Improve teacher card UI

教师卡片新增：

```text
Evidence quotes
Candidate explanations
Missing evidence
Risk if overdiagnosed
Safety notes
Provider / model / latency
Downgrade reason
Validation state
```

### Issue 7：Add phase manipulation demo page

固定一个学生短答，允许切换教学阶段：

```text
刚引入 -> Ask
练习后 -> Probe
小组讨论 -> Hold
```

这是最适合给导师展示论文贡献的页面。

### Issue 8：Add baseline condition generator

支持：

```text
standard_llm
over_committed
evidence_only
probemate
no_ai
```

这能直接服务 Study 2 / Study 3。

### Issue 9：Research dashboard quality metrics

新增统计：

```text
LLM runs
schema failures
no-quote downgrades
bad-timing holds
teacher edits
teacher delays
average latency
fallback runs
```

### Issue 10：README update for v1.1 roadmap

把当前状态写清楚：

```text
v1.0.0 = mock diagnostic gate + research workflow
v1.1 = LLM-backed candidate generation
v1.2 = experimental condition generator
v1.3 = dashboard and research quality metrics
```

## 12. 演示脚本

下次给导师演示时，不要只展示页面，应按研究主张组织演示。

### Step 1：创建 checkpoint

问题：

```text
汽车向前运动，但速度越来越小，它的加速度方向是什么？
```

目标概念：

```text
加速度方向
```

教学阶段：

```text
刚引入
```

### Step 2：学生提交短答

学生回答：

```text
向前，因为车还在往前走。
```

### Step 3：运行 LLM diagnostic gate

系统显示：

```text
Candidate explanations:
1. 可能混淆运动方向和加速度方向
2. 可能只是没有表达速度变化量
3. 证据不足，需要画图确认

Evidence quote:
“还在往前走”

Move:
Ask for Evidence

Why this move:
证据可疑，但不足以直接诊断。
```

### Step 4：切换教学阶段

改成：

```text
已练过减速运动
```

重新运行。

系统输出变成：

```text
Move:
Diagnostic Probe

Teacher move:
如果速度箭头在变短，速度变化量指向哪里？
```

### Step 5：切换当前活动

改成：

```text
小组讨论中
```

重新运行。

系统输出变成：

```text
Move:
Hold

Why this move:
当前活动不适合插入新的教师追问，先保留该回答供讨论后回看。
```

演示结论：

```text
ProbeMate 不是普通 LLM 追问生成器。
它在教师下一句话之前，判断证据是否够、时机是否合适、介入承诺是否过强。
```

## 13. 开发优先级

### P0：不破坏 v1.0.0

- 现有 mock flow 继续可用。
- 现有教师端、学生端、研究后台不退化。
- 现有测试继续通过。

### P1：LLM 接入最小闭环

- provider switch。
- structured output。
- schema validation。
- quote audit。
- gate decision。
- provider metadata 写入 episode log。

### P2：教师卡片和研究后台可解释

- 教师能看到证据和降级原因。
- 研究者能看到 provider、model、prompt、schema、latency、failure、downgrade。

### P3：实验材料生成

- baseline condition generator。
- phase manipulation demo。
- condition 维度进入 research dashboard。

### P4：工程化持久化和部署

- repository 抽象。
- PostgreSQL / Supabase。
- 账号、班级、权限、数据治理。

## 14. 测试计划

### 14.1 后端单元测试

新增测试：

```text
test_provider_switch_mock_keeps_existing_behavior
test_openai_provider_success_with_valid_schema
test_schema_validation_failure_downgrades
test_invalid_quote_downgrades_to_ask
test_bad_timing_downgrades_to_hold
test_answer_leakage_risk_downgrades
test_episode_log_records_ai_metadata
test_csv_exports_ai_metadata
test_condition_generator_outputs_all_conditions
```

### 14.2 前端检查

必须继续通过：

```powershell
npm run lint
npm run build
```

新增页面检查：

- provider 状态是否展示。
- 教师卡片是否展示 evidence 和 safety。
- 研究后台是否展示新字段。
- phase manipulation 是否能切换 Ask / Probe / Hold。

### 14.3 端到端流程

扩展 `frontend/scripts/devtools-flow-test.cjs`：

1. 创建 checkpoint。
2. 学生提交短答。
3. 设为代表回答。
4. mock 模式运行分析。
5. LLM mock fixture 模拟有效输出。
6. LLM mock fixture 模拟 invalid quote。
7. LLM mock fixture 模拟 schema failure。
8. 教师执行 Use / Edit / Delay / Skip。
9. 研究后台筛选 provider、move、condition。
10. CSV 检查去标识化和新增字段。

## 15. 数据与版本规范

### 15.1 版本字段

每次分析必须记录：

```text
gate_version
prompt_version
schema_version
ai_provider
model_name
```

### 15.2 prompt 管理

新增目录：

```text
api/app/prompts/
  candidate_generation_v0_1.md
  baseline_standard_llm_v0_1.md
  baseline_over_committed_v0_1.md
  evidence_only_v0_1.md
```

要求：

- prompt 版本必须写入 episode log。
- prompt 修改需要更新版本号。
- 研究实验条件不能偷偷改 prompt。

### 15.3 CSV 字段同步

任何新增研究字段必须同步：

1. `EpisodeLog`
2. `export.py`
3. `data_dictionary.py`
4. `frontend/lib/types.ts`
5. `frontend/app/research/page.tsx`
6. README 或 plan

## 16. 风险与控制

| 风险 | 影响 | 控制 |
| --- | --- | --- |
| LLM 幻觉学生原话 | 错误诊断 | quote audit，invalid quote 降级 |
| LLM 输出结构不稳定 | 后端异常或字段缺失 | Pydantic validation，schema failure 降级 |
| 模型超时 | 课堂流程卡住 | timeout + fallback |
| 过早诊断 | 损害学生表达和研究可信度 | evidence ambiguous 降级 Ask |
| 当前活动不适合插入 | 打断课堂流 | bad timing Hold |
| 研究日志不可复盘 | 论文证据不足 | provider/model/prompt/schema/downgrade 全记录 |
| UI 信息过载 | 教师不愿使用 | 教师主卡片简洁，审计信息可折叠 |
| 数据敏感 | 伦理风险 | 匿名 ID、去标识化、留存策略 |

## 17. 最终路线图

```text
v1.0.0 已完成：
mock diagnostic gate + classroom workflow + research log

v1.1：
LLM-backed candidate generation + schema validation + evidence audit + AI metadata

v1.2：
baseline condition generator + phase manipulation demo + condition logging

v1.3：
teacher dashboard 三栏优化 + 首页流程图 + research quality metrics

v1.4：
PostgreSQL / Supabase + repository abstraction + migration script

v1.5：
teacher login + class management + data governance + classroom deployment readiness
```

## 18. 下一步执行顺序

建议立即执行：

1. 新增 `CandidateGenerationResult`、AI provider 配置和 mock provider interface。
2. 把当前 `mock_candidate_generator()` 包装为 `MockCandidateGenerator`。
3. 增加 `LLMCandidateGenerator`，先用测试 fixture 跑通，不急于真实 key。
4. 增加 schema validation 和 quote audit。
5. 扩展 `EpisodeLog`、CSV 和数据字典。
6. 改教师卡片展示 evidence、candidate、safety、provider 和 downgrade reason。
7. 补 API 测试。
8. 真实 provider 配置后再跑端到端流程。

当前最重要的交付不是“更多功能”，而是完成这条链：

```text
真实 LLM 候选解释
-> 引用学生原话
-> Pydantic / JSON schema 校验
-> 规则化 Diagnostic Gate
-> Hold / Ask / Probe
-> 教师端卡片
-> 研究日志记录 provider、model、prompt、latency、downgrade reason
```

做到这一步后，ProbeMate Web 才从“流程原型”升级为“可以支撑论文主张的 AI 原型”。
