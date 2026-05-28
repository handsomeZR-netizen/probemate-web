我重新看了当前 GitHub 仓库和你截图里的状态。结论是：**现在已经不是最早的空壳 demo 了，后端能力比界面上看起来多；但整体仍然像“研究流程原型”，还不像一个可以顺畅演示、可操作、可部署的 ProbeMate 系统。**

当前 README 已写成 `v1.1.0`，并声明完成了 provider switch、结构化输出校验、quote audit、Hold / Ask / Probe gate、教师卡片审计字段、研究后台质量指标、实验条件生成、phase manipulation、PostgreSQL 切换和访问码登录等功能；但默认 AI 模式仍然是 `AI_PROVIDER=mock`，默认存储仍然是本地 JSON store。([GitHub](https://github.com/handsomeZR-netizen/probemate-web)) 仓库 release 区域仍显示最新 release 是 `ProbeMate Web v1.0.0`，这和 README 的 `v1.1.0` 状态也不一致，会进一步让人感觉“版本混乱、功能不完整”。([GitHub](https://github.com/handsomeZR-netizen/probemate-web))

## 1. 当前状态重新判断

### 1.1 现在已经有的东西

当前仓库已经具备一个基本闭环：

> 教师创建 checkpoint → 学生提交短答 → 教师选择代表回答 → CandidateGenerator → schema validation → evidence quote audit → diagnostic gate → teacher card → teacher action → episode log / CSV export。

README 里也明确把这个流程列成 Core Workflow，并说明 LLM 只输出 `CandidateOutput`，不直接决定最终诊断动作；`student_quotes` 必须能在学生原话中找到；当前活动为同伴讨论、实验观察或教师收束时优先 Hold；证据不足、schema 错误、provider 错误或答案泄露风险高时降级为 Ask/Hold。([GitHub](https://github.com/handsomeZR-netizen/probemate-web))

这说明后端逻辑方向是对的：它已经在向论文里的“证据先于介入”靠近。原论文系统设计也要求 ProbeMate 面向短书面 checkpoint，先绑定课堂上下文，再生成候选解释、证据审计、执行承诺 policy，最后给教师端可编辑探针。

### 1.2 现在最大的问题

问题不是“完全没做”，而是 **功能被做成了分散的工程接口，没有被组织成一个清晰、可信、可演示的软件体验**。

你现在的感觉是对的：

1. **教师端页没有返回主页**，说明还缺一个全局 App Shell / Breadcrumb 设计。
2. **很多功能像是后端有，但前端没有充分显性化**，例如 provider 状态、真实 LLM 运行、实验条件生成、数据治理、研究质量指标等。
3. **现在看到的还是 mock**，说明真实 LLM provider 没有被当前运行环境启用，或者旧卡片缓存仍然在展示 mock 结果。
4. **功能完整性不够**，因为它还不是一个完整“课堂工作台 + 研究工作台 + AI 配置台 + 实验材料生成器”的系统。
5. **可操作性不够**，因为教师端还没有形成“创建课堂 → 展示学生入口 → 收集回答 → 选择代表回答 → AI 诊断 → 教师处理 → 队列回看”的强流程。
6. **丰富性不够**，因为现在主要是表单、列表和日志，缺少教师真正能感知到的 AI 分析过程、课堂操作节奏和研究证据闭环。

所以我建议接下来不要小修小补，而是按 **ProbeMate v2.0** 的思路重构产品结构。

------

## 2. 为什么现在还是 mock？

当前 `.env.example` 里默认就是：

```env
AI_PROVIDER=mock
AI_MODEL=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
```

也就是说，如果你只是按默认方式启动，系统一定会走 mock。([GitHub](https://raw.githubusercontent.com/handsomeZR-netizen/probemate-web/main/.env.example)) README 也写得很清楚：provider modes 包括 `AI_PROVIDER=mock`、`AI_PROVIDER=openai` 和 `AI_PROVIDER=deepseek`；其中 mock 是 deterministic local candidate generator，用于开发和测试。([GitHub](https://github.com/handsomeZR-netizen/probemate-web))

代码层面已经有 `MockCandidateGenerator`、`OpenAICandidateGenerator`、`DeepSeekCandidateGenerator` 和 `UnsupportedCandidateGenerator`，也就是说**不是完全没有接 LLM，而是当前运行状态没有启用真实 provider**。([GitHub](https://raw.githubusercontent.com/handsomeZR-netizen/probemate-web/main/api/app/services/candidate_generators.py))

另外，还有一个容易忽略的问题：分析接口会缓存旧卡片。`pipeline.py` 里如果不是 `force_rerun`，会先读 `store.get_latest_card_for_response(response.id)`，所以你切换 provider 后，如果点的是普通“分析”而不是“重新分析”，可能仍然看到之前的 mock 卡片。([GitHub](https://raw.githubusercontent.com/handsomeZR-netizen/probemate-web/main/api/app/services/pipeline.py))

还有一个特殊点：`phase-manipulation` demo 当前代码直接调用 `mock_candidate_generator(input_pack)`，所以这个页面即使你切到真实 LLM，也仍然会用 mock 逻辑生成 Ask / Probe / Hold 演示。([GitHub](https://raw.githubusercontent.com/handsomeZR-netizen/probemate-web/main/api/app/services/experimental.py))

所以“为什么还是 mock”的原因很可能有四个：

1. 环境变量仍是 `AI_PROVIDER=mock`。
2. API key 或 model 没有配置。
3. 后端启动时没有真正加载 `.env`。
4. 页面读到了旧的 cached card，需要点“重新分析”或清空 dev store。
5. phase demo 本来就是写死用 mock 的。

------

## 3. 先做一个 P0 热修复：让 demo 不再“不舒服”

这一步应该马上做，半天到一天能完成。

### P0-1：所有页面统一加 App Shell

现在首页有“教师端 / 研究后台 / 登录 / 阶段演示”，但进入教师端后没有清楚的返回主页；checkpoint 详情页有“返回教师端”，但没有完整路径。应该抽一个统一组件：

```tsx
<AppShell
  breadcrumbs={[
    { label: "首页", href: "/" },
    { label: "教师端", href: "/teacher" },
    currentCheckpoint ? { label: currentCheckpoint.target_concept } : undefined
  ]}
  rightActions={<ProviderStatusBadge />}
/>
```

所有页面顶部统一显示：

```text
首页 / 教师端 / 当前 checkpoint
AI: mock / deepseek / openai
Storage: json / postgres
Auth: open / protected
```

这样老师一眼能知道自己在哪里、系统现在是不是接了真实 AI。

### P0-2：教师端 `/teacher` 增加“返回首页”

当前教师端页标题下直接是“教师端 checkpoint / 先创建短答入口……”，应该顶部加：

```text
← 返回首页
教师端 checkpoint
先创建短答入口，再进入 dashboard 运行诊断闸门。
```

这不是小问题。一个系统如果从教师端回不到首页，会让人感觉像临时拼出来的页面，而不是完整产品。

### P0-3：首页改成真正的 Command Center

现在首页已经有流程图和入口卡片，但还不够“诊断系统”的感觉。首页应该显示：

```text
ProbeMate 状态
AI Provider: mock / openai / deepseek
Model: ...
Configured: yes / no
Storage: json / postgres
Auth: open / protected
Total checkpoints: ...
Total episodes: ...
```

然后四个入口：

1. **Live Classroom / 教师课堂**
2. **Study Builder / 实验材料生成**
3. **Research Console / 研究后台**
4. **System Settings / 系统设置**

当前 README 里已经有 provider status API、data governance API、research logs、CSV、data dictionary 等接口，但它们还没有被组织成一个清晰的控制台。([GitHub](https://github.com/handsomeZR-netizen/probemate-web))

------

## 4. P1：先把真实 LLM 跑通，并且让前端明确显示“不是 mock”

这一步是下一轮最重要的。现在系统看起来“不够 AI”，核心就是因为前端显示出来的仍然是 `AI mock`。

### P1-1：增加 `/settings/ai` 或 `/admin/provider` 页面

不要只靠环境变量和小 badge。需要一个明确的 AI 设置页：

```text
AI Provider
[ mock ] [ openai ] [ deepseek ]

Current model:
deepseek-v4-flash / gpt-xxx / custom

Configured:
Yes / No

Last AI run:
provider, model, latency, raw_llm_valid, fallback_used

Test prompt:
学生回答：向前，因为车还在往前走。
[运行 provider 测试]
```

这个页面不一定真的在前端保存 key，key 仍然走环境变量；但前端必须显示：

```text
当前真实运行的是谁？
有没有配置 key？
上一次分析是不是 fallback？
为什么 fallback？
```

否则老师和你自己都会一直怀疑“到底有没有接 LLM”。

### P1-2：启动真实 provider 的本地操作必须写进 README 和 UI

现在 README 写了 provider modes，但从操作上还是容易踩坑。应该写成两个启动脚本。

PowerShell 示例：

```powershell
cd api
$env:AI_PROVIDER="deepseek"
$env:DEEPSEEK_API_KEY="你的 key"
$env:AI_MODEL="实际可用模型名"
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

或者：

```powershell
cd api
$env:AI_PROVIDER="openai"
$env:OPENAI_API_KEY="你的 key"
$env:AI_MODEL="实际可用模型名"
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

更稳的是加脚本：

```text
scripts/run-api-mock.ps1
scripts/run-api-deepseek.ps1
scripts/run-api-openai.ps1
```

因为现在代码是通过 `os.getenv` 读取环境变量，不要默认以为 `.env` 文件一定被加载。([GitHub](https://raw.githubusercontent.com/handsomeZR-netizen/probemate-web/main/api/app/services/candidate_generators.py))

### P1-3：分析卡片必须强显示 AI 来源

教师卡片顶部应该显示：

```text
AI run
Provider: deepseek
Model: ...
Latency: 3210ms
Validation: valid
Quote audit: passed
Fallback: no
Cached: no
```

如果是 mock，就要明显写：

```text
当前为 mock provider，仅用于演示，不代表真实 LLM 输出。
```

如果是 baseline，就写：

```text
当前为实验 baseline，不是 ProbeMate LLM 输出。
```

你现在研究日志里出现 `AI = mock` 和 `AI = baseline`，其实是合理的，但 UI 没解释，所以看起来像“系统全是假数据”。

### P1-4：缓存和重新分析要更明确

现在“分析代表回答”和“重新分析”容易混淆。建议改成：

```text
读取/生成卡片
重新运行 AI
清除该回答缓存
```

并在卡片上显示：

```text
cached: yes / no
created_at
provider at creation
```

这样切换 LLM 后，你能确认新结果不是旧 mock 缓存。

------

## 5. P2：重做教师端，不要让它只是“创建 checkpoint + 列表”

这是你现在觉得功能少的核心原因。教师端应该从一个列表页变成一个 **Live Classroom Workspace**。

### 5.1 新的教师端信息架构

建议改成：

```text
/teacher
  今日课堂 / 最近课堂
  新建 checkpoint
  模板库
  快速演示

/teacher/checkpoints/[id]
  课堂运行工作台

/teacher/checkpoints/[id]/student-view
  学生入口预览

/teacher/checkpoints/[id]/review
  课后回看队列
```

### 5.2 checkpoint 详情页改成三栏

当前详情页已经有代表回答、学生短答、ProbeMate 卡片，但视觉上还是拼接感比较强。建议改成三栏固定工作流：

```text
左栏：课堂与入口
- checkpoint 问题
- 目标概念
- 教学阶段 / 当前活动
- 学生入口二维码
- 打开 / 关闭提交
- 当前 provider 状态
- 待处理队列

中栏：学生短答池
- 全部短答
- 代表回答
- 把握程度
- 来源：学生扫码 / 教师代表 / 导入 episode
- 搜索 / 筛选 / 聚类
- 设为代表
- 运行诊断闸门

右栏：ProbeMate 卡片
- Move
- Why this move
- Evidence quotes
- Candidate explanations
- Missing evidence
- Risk if overdiagnosed
- Safety notes
- Teacher move
- Use / Edit / Delay / Skip
```

这和论文系统要求一致：学生短答进入后，系统需要把候选解释、证据审计、课堂行动和教师改写连起来，而不是只展示一个建议句。

### 5.3 增加二维码弹窗

教师端必须有一个大按钮：

```text
展示学生入口
```

点击后弹出：

```text
课堂码：93C3DC
二维码
学生入口链接
复制链接
投屏模式
```

现在只显示 code 和复制链接，课堂感不够。真实课堂里，教师首先需要的是“让学生能进来”。

### 5.4 增加短答聚类或代表回答推荐

目前教师需要自己设代表回答。下一步可以先做轻量版，不一定马上做 embedding：

第一阶段规则聚类：

```text
包含“向前 / 往前走” → 运动方向类
包含“速度变小 / 变化量” → 速度变化类
空泛短答 → 证据不足类
```

第二阶段再做 embedding 聚类：

```text
cluster label
representative answer
count
example answers
```

教师端显示：

```text
系统建议分析这 3 类代表回答：
1. “向前，因为车还在往前走。” 12 人
2. “向后，因为速度变小。” 8 人
3. “不知道。” 5 人
```

这会让功能丰富度明显提升，也更符合原论文设想：教师可以选择 1–5 条典型回答进入系统，或者由系统聚类后推荐代表性回答。

------

## 6. P3：把“实验条件生成”升级成真正的 Study Builder

现在仓库已经有 `/experimental/generate-condition`，也有 `no_ai`、`standard_llm`、`over_committed`、`evidence_only`、`probemate` 等条件。README 和 API surface 都列出了实验条件生成接口。([GitHub](https://github.com/handsomeZR-netizen/probemate-web)) 但现在它只是藏在 checkpoint 详情里的几个按钮，不像一个研究工具。

应该单独做一个模块：

```text
/study-builder
```

### 6.1 Study Builder 页面结构

```text
Study Builder
1. 选择 episode
2. 选择实验条件
3. 生成材料
4. 预览教师看到的卡片
5. 随机化 / 盲化标签
6. 导出 Study 2 / Study 3 材料
```

### 6.2 支持 Study 2 专家评价

生成专家评价材料：

```text
课堂问题
学生短答
教学阶段
候选输出 A/B/C/D
专家问题：
- 哪个输出更适合当前课堂？
- 哪个更可能过早诊断？
- 哪个过弱？
- 哪个更能保留学生自我修正？
```

### 6.3 支持 Study 3 教师 next-turn 实验

生成教师参与者页面：

```text
你正在上课。
课堂问题：...
学生回答：...
教学阶段：...
AI 建议：Assistant B
请在 30 秒内写出你的下一句话。
```

现在的系统主要记录教师动作，但还不是一个真正的 timed vignette experiment。论文 Study 3 需要 No-AI / Standard LLM / Over-committed / Evidence-only / ProbeMate 五条件，并记录 next-turn quality、over/under-commitment、uptake/edit/delay、decision time/load 等。 所以 Study Builder 是必须做的，不然软件和论文验证之间还差一层。

------

## 7. P4：研究后台从“日志表”升级成“研究证据仪表盘”

现在研究后台已经能看 episode log、筛选、导出 CSV。README 也写了研究后台支持 move、来源、教师动作、队列状态、condition 筛选，并能查看 fallback、schema failure、invalid quote downgrade、bad timing hold、平均延迟等质量指标。([GitHub](https://github.com/handsomeZR-netizen/probemate-web))

但从你的截图看，当前后台仍然像一张日志表。下一步要变成研究证据 dashboard。

### 7.1 顶部统计不要只看 Hold / Ask / Probe

现在有：

```text
总 EPISODE
HOLD
ASK
PROBE
FALLBACK
INVALID LLM
```

建议改成两排：

```text
运行状态
Total episodes
Real LLM runs
Mock runs
Baseline runs
Fallback
Invalid LLM

DCR 质量
Evidence-first actions
Bad-timing holds
No-quote downgrades
Answer-leakage downgrades
Teacher edits
Teacher delays
```

尤其是要显示：

```text
Real LLM runs: 0
Mock runs: 26
Baseline runs: 6
```

这样你一眼就知道为什么“看起来还是 mock”。

### 7.2 增加 Over / Under 研究字段

论文不是只要看系统输出了多少 Ask / Probe，而是要证明它同时减少过强和过弱。论文明确说，真正的诊断承诺调节必须同时避免 harmful over-commitment 和 harmful under-commitment，不能只证明 AI 少说。

研究后台可以增加人工标注列：

```text
expert_preferred_move
commitment_distance
harmful_over_commitment
harmful_under_commitment
answer_leakage
self_correction_support
```

然后显示：

```text
ProbeMate vs baseline
- over-commitment blocked
- under-commitment avoided
- average commitment distance
```

这会让后台真正服务 Study 2 / Study 3，而不是只导出日志。

### 7.3 增加“数据字典 / 字段解释”固定侧栏

现在如果研究后台列很多字段，外人很难理解。建议右侧做一个可折叠 panel：

```text
字段解释
Move
Evidence
Validation
Downgrade
Teacher Action
Decision Time
Condition
```

这样老师看时会觉得这是一个严肃研究系统，不是普通后台表格。

------

## 8. P5：处理“mock / demo 数据污染”的问题

你现在课堂列表里有很多 `DevTools action-skip`、`DevTools action-delay` 之类的记录，看起来很像测试数据污染正式界面。这个必须处理。

### 8.1 增加 Demo Mode 和 Real Mode

系统顶部增加模式：

```text
Mode: Demo / Research / Classroom Pilot
```

Demo mode 可以 seed 一堆演示数据；Research / Classroom Pilot 不显示 DevTools 数据。

### 8.2 增加清空开发数据按钮

在 settings 页增加：

```text
清空 dev store
重置 demo 数据
导入标准 demo episodes
```

本地 JSON store 默认路径是 `api/data/dev-store.json`，README 也说明可以通过 `PROBEMATE_STORE_PATH` 改路径；这就很适合做“一键重置演示数据”。([GitHub](https://github.com/handsomeZR-netizen/probemate-web))

### 8.3 Demo 数据要像研究材料，不要像开发测试

不要叫：

```text
DevTools action-skip
DevTools action-delay
```

改成：

```text
加速度方向：弱证据 Ask 示例
加速度方向：强证据 Probe 示例
小组讨论：时机不合适 Hold 示例
摩擦力：相对运动趋势示例
自由落体：探究前直觉示例
```

这样 demo 数据本身就是论文故事的一部分。

------

## 9. P6：真实课堂部署前的产品化补齐

当前 README 说 optional access control 是 teacher/researcher access-code login，默认本地开发路由可以开放；如果设置访问码，teacher/research routes 需要 Bearer token。([GitHub](https://github.com/handsomeZR-netizen/probemate-web)) 这对 demo 足够，但对真实课堂还不够。

下一阶段需要补：

```text
教师账号
班级管理
课次管理
学生匿名规则
数据保留周期
导出权限
原始短答访问权限
学生端用途告知
LLM provider 日志
失败 fallback
正式部署配置
```

论文 Study 4 本身也不是要证明大规模学习增益，而是要观察系统进入真实课堂后如何被教师挪用，以及 written checkpoint 改变课堂证据的代价。 所以真实课堂版本必须把 checkpoint 耗时、教师取消、学生提交率、教师改写、延迟处理等作为一等功能记录下来。

------

## 10. 建议的新版本路线图

### v1.1.1：体验热修复

目标：让当前系统不再显得临时。

任务：

```text
1. 教师端增加返回首页。
2. 所有页面增加统一 AppShell / breadcrumbs。
3. 首页显示 provider / storage / auth 状态。
4. 教师端显示“当前 AI 是 mock 还是 real”。
5. 研究后台增加 Real LLM runs / Mock runs / Baseline runs。
6. 删除或隔离 DevTools 测试数据。
7. README 修正 v1.1.0 与 release v1.0.0 不一致问题。
```

验收标准：

```text
打开首页就能知道系统状态；
进入教师端能返回首页；
看到 mock 时不会误以为真实 LLM；
研究后台能解释为什么都是 mock。
```

------

### v1.2：真实 LLM 可演示版

目标：让系统真的跑一次 LLM-backed diagnostic gate。

任务：

```text
1. 新增 AI Settings 页面。
2. 提供 provider smoke test。
3. 明确加载环境变量的方式。
4. 支持 deepseek / openai 的真实运行截图。
5. 重新分析时强制绕过缓存。
6. 卡片显示 provider、model、latency、validation、fallback。
7. phase demo 可选择 mock / real provider。
```

验收标准：

```text
截图里 AI 不再只是 mock；
同一条学生短答能显示真实 provider 返回的候选解释；
quote audit 和 downgrade reason 能正常工作；
provider 失败时 fallback 不崩。
```

------

### v1.3：教师 Live Classroom 工作台

目标：让教师端真正像课堂工具。

任务：

```text
1. checkpoint 详情页三栏重构。
2. 学生入口二维码 / 投屏模式。
3. 短答实时刷新优化。
4. 代表回答推荐或轻量聚类。
5. 当前课堂阶段可在 dashboard 内快速切换。
6. Hold / Delay 队列可回看和处理。
7. 教师动作后显示“这条 episode 已进入日志”。
```

验收标准：

```text
教师能完整走完一节课内的 checkpoint 流程；
不用解释太多，老师也能知道下一步点哪里；
ProbeMate 卡片不只是结果，而是可操作课堂动作。
```

------

### v1.4：Study Builder 研究材料生成器

目标：让软件直接支撑 Study 2 / Study 3。

任务：

```text
1. 单独建立 /study-builder。
2. 支持五条件材料生成。
3. 支持 blind label：Assistant A/B/C/D/None。
4. 支持 phase manipulation 批量生成。
5. 支持 timed teacher response 页面。
6. 支持 expert rating 表单。
7. 支持导出 materials.csv、ratings.csv、episode_logs.csv。
```

验收标准：

```text
同一个 episode 可以生成 Study 2 专家评价材料；
可以生成 Study 3 教师 next-turn 实验页面；
condition、teacher response、decision time 都进入日志。
```

------

### v1.5：Research Console 研究证据版

目标：后台不只是日志，而是论文结果准备台。

任务：

```text
1. 增加 over/under-commitment 标注字段。
2. 增加 commitment distance。
3. 增加 expert preferred move。
4. 增加 by condition 的比较图。
5. 增加 by provider 的质量统计。
6. 增加 deidentified/raw export 切换。
7. 增加数据字典侧栏。
```

验收标准：

```text
研究后台能直接看 ProbeMate 相对 baseline 的风险减少；
能导出写 Study 2 / Study 3 所需的数据；
能区分真实 LLM 输出、mock 输出、baseline 输出和 fallback 输出。
```

------

### v1.6：课堂 pilot 准备版

目标：能进小规模真实课堂试用。

任务：

```text
1. PostgreSQL / Supabase 生产存储。
2. 教师 / 研究者访问码或账号。
3. 班级与课次管理。
4. 学生匿名 ID 规则。
5. 学生端用途告知和关闭状态。
6. 数据保留策略。
7. 导出去标识化。
8. provider failure fallback。
9. 部署文档。
10. pilot checklist。
```

验收标准：

```text
可以给 1–2 位教师真实试用；
学生端不暴露误概念标签；
教师端不自动公开诊断；
研究者能拿到可分析日志。
```

------

## 11. 具体 GitHub issues 建议

你可以直接按下面建 issues。

### Issue 1：Add global AppShell and breadcrumbs

范围：

```text
/
 /teacher
 /teacher/checkpoints/[id]
 /research
 /demo/phase-manipulation
 /login
```

验收：

```text
所有页面都有返回首页；
checkpoint 详情页路径显示 首页 / 教师端 / checkpoint；
右上角显示 provider 状态。
```

------

### Issue 2：Add provider status panel on home page

显示：

```text
AI provider
model
configured
fallback available
storage backend
auth mode
```

验收：

```text
默认 mock 时明确提示“仅演示模式”；
真实 provider 配置后显示 provider 和 model。
```

------

### Issue 3：Fix real LLM activation workflow

范围：

```text
.env loading
run scripts
README
provider smoke test
cache/rerun behavior
```

验收：

```text
AI_PROVIDER=deepseek 或 openai 后，卡片 AI 字段不再是 mock；
重新分析能绕过旧缓存；
provider 失败时 fallback 有日志。
```

------

### Issue 4：Make phase manipulation support real provider

当前 phase demo 写死 mock。改成：

```text
provider=mock | current
```

验收：

```text
mock 模式稳定展示 Ask / Probe / Hold；
current provider 模式可以跑真实 LLM；
页面说明两者区别。
```

------

### Issue 5：Rebuild teacher checkpoint page as three-column workspace

验收：

```text
左栏课堂入口；
中栏短答池；
右栏 ProbeMate 卡片；
桌面端不滚动过乱；
移动端顺序合理。
```

------

### Issue 6：Add QR display and classroom projection mode

验收：

```text
教师能一键投屏二维码；
显示课堂码和学生入口；
学生提交后教师端自动刷新。
```

------

### Issue 7：Add representative response recommendation

先做规则版：

```text
按关键词 / 短答相似度 / 空泛回答分组
```

后做 embedding 版。

验收：

```text
教师能看到“建议分析的代表回答”；
每类显示人数和例句。
```

------

### Issue 8：Create Study Builder module

验收：

```text
能为同一 response 生成 no_ai、standard_llm、over_committed、evidence_only、probemate；
能导出 Study 2 / Study 3 材料；
condition 不覆盖 ProbeMate 原始日志。
```

------

### Issue 9：Upgrade research dashboard to evidence console

验收：

```text
显示 Real LLM runs、Mock runs、Baseline runs；
显示 downgrade reasons；
显示 teacher agency；
显示 over/under 标注入口。
```

------

### Issue 10：Clean demo data and add reset/import scripts

验收：

```text
不再显示 DevTools action-skip 这类测试标题；
可以一键导入标准演示 episode；
可以清空本地 dev store。
```

------

## 12. 我建议你下一步实际怎么做

我建议顺序非常明确：

### 第一周：修体验 + 让真实 LLM 清楚跑起来

做：

```text
AppShell
返回首页
Provider 状态首页展示
AI settings / smoke test
真实 provider run script
重新分析绕过缓存
研究后台区分 mock / baseline / real LLM
```

目标：下次截图不能再让人问“是不是没接 LLM”。

### 第二周：重做教师工作台

做：

```text
三栏 dashboard
二维码投屏
代表回答推荐
ProbeMate 卡片增强
Hold / Delay 队列处理
```

目标：老师能看出这是一个课堂工具，而不是一个日志 demo。

### 第三周：Study Builder

做：

```text
五条件材料生成
phase manipulation 批量生成
timed teacher response
expert rating export
```

目标：软件直接服务论文 Study 2 / Study 3。

### 第四周：Research Console + pilot readiness

做：

```text
over/under 标注
commitment distance
研究图表
Postgres / Supabase
权限
数据治理
```

目标：可以小规模给教师试用，也可以开始准备真实研究数据。

------

## 13. 最关键的判断

现在这个 demo 的问题不是“功能太少”这么简单，而是：

> **功能已经开始有了，但产品结构没有把这些功能组织成一个可信的 ProbeMate 系统。**

你现在应该大刀阔斧地把它拆成四个清楚模块：

```text
1. Live Classroom：教师课堂使用
2. Study Builder：研究材料生成
3. Research Console：日志、指标和导出
4. System Settings：AI provider、存储、权限和数据治理
```

只要把这四块搭起来，再把真实 LLM 状态显示清楚，这个系统就会从“mock demo”变成“能支撑论文主张的研究型软件原型”。