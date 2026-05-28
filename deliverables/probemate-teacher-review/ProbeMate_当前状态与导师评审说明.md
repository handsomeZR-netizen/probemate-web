# ProbeMate 当前状态与导师评审说明

生成时间：2026-05-28
评审用途：给导师快速了解 ProbeMate 当前可演示状态、核心卖点、使用路径、技术架构与下一步建议。

> 安全说明：本文档不包含 API Key、`.env`、数据库文件或源码副本。当前只记录“DeepSeek 已配置”这一运行状态。

## 1. 一句话介绍

ProbeMate 是一个面向课堂短答的“诊断闸门”原型。它不直接替老师判断学生是否存在误概念，而是在老师说出下一句话之前，把学生短答、课堂阶段、证据强度和介入风险组织成可审计的 `Hold / Ask for Evidence / Diagnostic Probe` 建议。

系统目标是帮助教师在课堂即时反馈中避免两个常见问题：

- 过早诊断：学生证据还不够时，系统提醒先追证据或暂缓介入。
- 答案泄露：如果建议过度暴露正确答案，系统通过 quote audit 和 gate 降级。
- 研究复盘困难：每次 AI 输出、教师动作、实验条件和 episode log 都可以导出，用于后续论文分析。

## 2. 当前运行状态

| 项 | 当前状态 |
|---|---|
| 前端地址 | `http://localhost:3000/zh` |
| 后端地址 | `http://127.0.0.1:8000` |
| App Mode | `demo` |
| AI Provider | `deepseek` |
| Model | `deepseek-v4-flash` |
| Provider 配置 | 已配置 |
| Fallback | 可用 |
| Storage | 本地 JSON store |
| Auth | 开放模式 |
| Checkpoints | 8 |
| Episode logs | 28 |
| 当前截图样例 checkpoint | `ckpt_79b53ca1d1` |
| 当前截图样例课堂码 | `650A3E` |

注意：系统当前 provider 已经指向 DeepSeek，但旧 episode 中仍有 mock/baseline 历史记录；教师工作台如需真实 provider 结果，应使用“重新运行 AI”绕过旧缓存。

## 3. 当前功能内容

### 3.1 落地页

首页已经改为导师友好的介绍型落地页，包含：

- Three.js 动态诊断网络背景。
- 高斯模糊视觉层。
- 项目卖点：证据先行、介入承诺可控、研究数据闭环。
- 三步用法：创建 checkpoint、选择代表回答、读取教师卡片。
- 使用效果：30 秒内形成下一句追问、降低过早诊断、沉淀 Study 2/3/4 数据。
- 入口导航：教师端、Study Builder、研究后台、AI 设置。

截图：[01_landing.png](screenshots/01_landing.png)

### 3.2 教师端

教师端用于创建课堂 checkpoint，并进入课堂工作台。当前支持：

- 选择课堂模板或自定义问题。
- 设置目标概念、班级/课次、教学阶段、当前活动、展示策略。
- 查看最近 checkpoint。
- 进入 checkpoint 工作台。

截图：[02_teacher_home.png](screenshots/02_teacher_home.png)

### 3.3 Checkpoint 工作台

工作台是核心课堂流程页面。当前支持：

- 展示课堂码和学生入口。
- 复制学生入口链接。
- 切换课堂语境。
- 手动录入教师代表回答。
- 查看学生短答列表。
- 系统根据短答做简单代表回答推荐。
- 选择代表回答后运行诊断闸门。
- 查看 ProbeMate 卡片：教师下一句话、为什么这样建议、provider、latency、quote audit、fallback、内部证据等。
- 记录教师动作：采用、改写、稍后处理、跳过。
- 生成实验条件材料。

截图：[03_teacher_checkpoint_workspace.png](screenshots/03_teacher_checkpoint_workspace.png)

### 3.4 学生入口

学生通过课堂码页面提交短答。当前支持：

- 显示 checkpoint 问题。
- 匿名编号可选。
- 输入短答。
- 选择把握程度。
- 提交后可继续修改。
- 如果 checkpoint 关闭，会提示回到课堂讨论。

截图：[04_student_entry.png](screenshots/04_student_entry.png)

### 3.5 Study Builder

Study Builder 用于从 episode 生成研究材料。当前支持：

- 选择一个 episode。
- 勾选五种条件：No-AI、Standard LLM、Over-committed、Evidence-only、ProbeMate。
- 随机化条件顺序。
- 生成盲化材料 Assistant A/B/C/D/E。
- 导出 `materials.csv`、`ratings.csv`、`next-turns.csv`、`episode_logs.csv`。
- 记录 Study 3 教师 next-turn 和 perceived load。
- 空状态已优化，避免导师看到空表格和无意义横向滚动。

截图：[05_study_builder.png](screenshots/05_study_builder.png)

### 3.6 研究后台

研究后台用于核对 Study 2/3/4 的 episode 字段。当前支持：

- 查看 episode log 表。
- 统计 Hold / Ask / Probe、fallback、invalid LLM、real/mock/baseline runs。
- 按 provider、condition、downgrade reason 查看分布。
- 按系统动作、来源、教师动作、队列状态、实验条件筛选。
- 标注 over / under。
- 导出 CSV。
- 查看数据字典。

截图：[06_research_console.png](screenshots/06_research_console.png)

### 3.7 Phase Manipulation

阶段演示页面用于展示同一句学生短答在不同课堂阶段下，gate 如何改变建议强度。

当前演示逻辑：

- 刚引入：通常倾向 Ask。
- 练习后：更可能 Probe。
- 小组互评中：更可能 Hold。

截图：[07_phase_manipulation.png](screenshots/07_phase_manipulation.png)

### 3.8 系统设置

系统设置页用于管理界面偏好和查看系统状态。当前支持：

- 浅色、深色、跟随系统主题。
- 中文 / English 语言切换。
- 查看 storage backend。
- 查看认证状态。
- 跳转 AI 设置、首页、教师端。

截图：[08_settings.png](screenshots/08_settings.png)

### 3.9 AI 设置

AI 设置页用于确认 provider 是否真实可用。当前支持：

- 查看 provider、model、configured、storage、auth、last run。
- 运行 provider smoke test。
- 切换 demo / research / classroom_pilot mode。
- 导入标准 demo episodes。
- 清空 dev store。

截图：[09_ai_settings.png](screenshots/09_ai_settings.png)

### 3.10 登录页

登录页用于部署后启用教师/研究者访问码。当前本地模式为开放状态。

截图：[10_login.png](screenshots/10_login.png)

## 4. 当前架构

### 4.1 前端

| 层 | 内容 |
|---|---|
| 框架 | Next.js 16 App Router |
| 路由 | `app/[locale]/...`，当前支持 `/zh` 和 `/en` |
| 国际化 | `next-intl`，中文和英文文案在 `messages/` |
| UI | shadcn 风格组件、Base UI、Tailwind CSS |
| 动画 | Motion for React |
| 3D 背景 | Three.js |
| 图标 | Phosphor Icons |
| 二维码 | `qrcode` |

核心页面结构：

```text
/zh
/zh/teacher
/zh/teacher/checkpoints/{id}
/zh/s/{checkpointCode}
/zh/study-builder
/zh/research
/zh/demo/phase-manipulation
/zh/settings
/zh/settings/ai
/zh/login
```

### 4.2 后端

| 层 | 内容 |
|---|---|
| 框架 | FastAPI |
| Provider | mock / OpenAI / DeepSeek |
| 当前 Provider | DeepSeek |
| 存储 | JSON store，另有 Postgres 抽象 |
| 认证 | 本地开放，可用 access code 启用 |
| 核心服务 | candidate generator、quote audit、diagnostic gate、study builder、research export |

核心接口：

```text
GET    /health
GET    /system/status
PATCH  /system/mode
GET    /ai/provider-status
POST   /ai/provider-smoke-test
GET    /checkpoints
POST   /checkpoints
GET    /checkpoints/{checkpoint_id}
PATCH  /checkpoints/{checkpoint_id}
GET    /checkpoints/code/{code}
GET    /checkpoints/{checkpoint_id}/responses
POST   /checkpoints/{checkpoint_id}/responses
PATCH  /responses/{response_id}
POST   /responses/{response_id}/analyze
DELETE /responses/{response_id}/analysis-cache
POST   /experimental/condition
POST   /study-builder/materials
POST   /study-builder/next-turns
POST   /demo/phase-manipulation
POST   /teacher-actions
GET    /research/episode-logs
GET    /research/evidence-summary
PATCH  /research/episode-logs/{log_id}/annotation
GET    /research/episode-logs.csv
GET    /research/data-dictionary
```

## 5. 核心数据流

```text
Teacher creates Checkpoint
  ↓
Students submit StudentResponse
  ↓
Teacher selects representative response
  ↓
InputPack is built from checkpoint + response + classroom context
  ↓
CandidateGenerator calls mock / OpenAI / DeepSeek
  ↓
CandidateOutput is schema-validated
  ↓
quote audit checks whether cited student quotes exist in the answer
  ↓
diagnostic gate decides Hold / Ask for Evidence / Diagnostic Probe
  ↓
TeacherCard is shown to teacher
  ↓
Teacher records use / edit / delay / skip
  ↓
EpisodeLog is saved for research export and analysis
```

## 6. 建议给导师看的演示路径

1. 打开首页：`http://localhost:3000/zh`
   - 先讲项目目标：不是替老师诊断，而是控制下一句追问的证据强度和介入风险。
2. 进入教师端：`/zh/teacher`
   - 创建或打开一个 checkpoint。
3. 打开学生入口：`/zh/s/{code}`
   - 展示学生如何提交短答。
4. 回到 checkpoint 工作台。
   - 选择代表回答。
   - 点击“重新运行 AI”，让 DeepSeek 重新生成结果，避免使用旧缓存。
5. 展示 ProbeMate 卡片。
   - 重点解释 quote audit、why this move、fallback、teacher move。
6. 进入 Study Builder。
   - 展示五条件材料生成和 CSV 导出。
7. 进入研究后台。
   - 展示 episode log、统计、标注和数据字典。

## 7. 当前需要导师给建议的问题

建议向导师重点确认：

1. “诊断闸门”这个概念是否容易理解，是否需要换成更教学化的说法。
2. 教师端工作流是否过复杂，是否需要把 Study Builder 和研究功能隐藏到二级入口。
3. Hold / Ask / Probe 三类建议是否足够覆盖课堂即时反馈。
4. Study 2/3/4 的五条件材料是否符合实验设计需求。
5. 研究后台字段是否足够支撑论文分析，是否需要补教师认知负荷、信任度、采纳理由等字段。
6. 落地页是否能让非技术导师快速理解“为什么需要这个系统”。

## 8. 已知限制

- 当前本地数据仍包含历史 mock/baseline 记录，因此研究后台中真实 LLM runs 可能不是主要数据来源。
- DeepSeek 已配置，但旧卡片会被缓存；演示真实模型时请使用“重新运行 AI”。
- 当前 store 是 JSON，本地演示足够；多人协作或部署需要切换 Postgres。
- 本地 auth 是开放模式，正式部署应配置访问码。
- 当前 UI 已有中文/英文，但导师评审包只截中文桌面页面。

## 9. 截图索引

| 编号 | 页面 | URL | 截图 |
|---|---|---|---|
| 01 | 落地页 | `/zh` | [01_landing.png](screenshots/01_landing.png) |
| 02 | 教师端首页 | `/zh/teacher` | [02_teacher_home.png](screenshots/02_teacher_home.png) |
| 03 | Checkpoint 工作台 | `/zh/teacher/checkpoints/ckpt_79b53ca1d1` | [03_teacher_checkpoint_workspace.png](screenshots/03_teacher_checkpoint_workspace.png) |
| 04 | 学生入口 | `/zh/s/650A3E` | [04_student_entry.png](screenshots/04_student_entry.png) |
| 05 | Study Builder | `/zh/study-builder` | [05_study_builder.png](screenshots/05_study_builder.png) |
| 06 | 研究后台 | `/zh/research` | [06_research_console.png](screenshots/06_research_console.png) |
| 07 | 阶段演示 | `/zh/demo/phase-manipulation` | [07_phase_manipulation.png](screenshots/07_phase_manipulation.png) |
| 08 | 系统设置 | `/zh/settings` | [08_settings.png](screenshots/08_settings.png) |
| 09 | AI 设置 | `/zh/settings/ai` | [09_ai_settings.png](screenshots/09_ai_settings.png) |
| 10 | 登录页 | `/zh/login` | [10_login.png](screenshots/10_login.png) |
