from app.schemas.models import DataDictionaryField


DATA_DICTIONARY = [
    DataDictionaryField(
        name="response_revision",
        type="integer",
        description="同一学生回答被编辑后的版本号，用于避免复用旧分析缓存。",
        source="StudentResponseRead.revision",
    ),
    DataDictionaryField(
        name="confidence_level",
        type="enum",
        description="学生提交短答时自报的把握程度。",
        source="StudentResponseRead.confidence_level",
        allowed_values=["unsure", "low", "medium", "high"],
    ),
    DataDictionaryField(
        name="response_source",
        type="enum",
        description="回答来源，用于区分学生扫码、教师代表输入或导入 episode。",
        source="StudentResponseRead.response_source",
        allowed_values=["student_qr", "teacher_representative", "imported_episode"],
    ),
    DataDictionaryField(
        name="class_name",
        type="string",
        description="教师为 checkpoint 标注的班级、课次或研究场次名称。",
        source="CheckpointRead.class_name",
        pii_risk="medium",
    ),
    DataDictionaryField(
        name="system_move",
        type="enum",
        description="ProbeMate gate 输出的教师动作类型。",
        source="GateDecision.move",
        allowed_values=["hold", "ask_for_evidence", "diagnostic_probe"],
    ),
    DataDictionaryField(
        name="queue_state",
        type="enum",
        description="Hold/Delay 项在教师待处理队列中的状态。",
        source="EpisodeLog.queue_state",
        allowed_values=["none", "queued", "resolved", "dismissed"],
    ),
    DataDictionaryField(
        name="decision_time_ms",
        type="integer",
        description="教师从看到卡片到记录动作的时间。",
        source="TeacherActionCreate.decision_time_ms",
    ),
    DataDictionaryField(
        name="teacher_feedback",
        type="string",
        description="教师对系统建议的使用理由、改写说明或课堂反馈备注。",
        source="TeacherActionCreate.teacher_feedback",
        pii_risk="medium",
    ),
    DataDictionaryField(
        name="study_perceived_load",
        type="integer",
        description="Study 3 教师 next-turn 任务后记录的主观负荷，1 到 7。",
        source="StudyNextTurnRequest.perceived_load",
        allowed_values=["1", "2", "3", "4", "5", "6", "7"],
    ),
    DataDictionaryField(
        name="study_note",
        type="string",
        description="Study Builder 参与者或研究者对 timed next-turn 回应的补充备注。",
        source="StudyNextTurnRequest.note",
        pii_risk="medium",
    ),
    DataDictionaryField(
        name="gate_reasons",
        type="string[]",
        description="gate 选择 Hold/Ask/Probe 的规则化原因。",
        source="GateDecision.gate_reasons",
    ),
    DataDictionaryField(
        name="ai_provider",
        type="string",
        description="生成候选解释的 AI provider。mock 表示本地规则模拟；openai/deepseek 表示真实 LLM provider。",
        source="TeacherCard.ai_provider / EpisodeLog.ai_provider",
        allowed_values=["mock", "openai", "deepseek"],
    ),
    DataDictionaryField(
        name="model_name",
        type="string",
        description="真实 provider 使用的模型名称；mock 模式为空。",
        source="TeacherCard.model_name / EpisodeLog.model_name",
    ),
    DataDictionaryField(
        name="raw_llm_valid",
        type="boolean",
        description="真实 LLM 输出是否通过结构化 schema 校验。",
        source="CandidateGenerationResult.raw_llm_valid",
    ),
    DataDictionaryField(
        name="validation_error",
        type="string",
        description="结构化输出校验失败的错误摘要。",
        source="CandidateGenerationResult.validation_error",
    ),
    DataDictionaryField(
        name="provider_error",
        type="string",
        description="provider 超时、网络错误、未配置或不支持 provider 的错误摘要。",
        source="CandidateGenerationResult.provider_error",
    ),
    DataDictionaryField(
        name="downgrade_reason",
        type="string",
        description="系统禁止更强诊断承诺并降级为 Hold/Ask 的主要原因。",
        source="GateDecision.downgrade_reason / CandidateGenerationResult.downgrade_reason",
        allowed_values=[
            "bad_timing",
            "no_valid_quote",
            "evidence_ambiguous",
            "answer_leakage_risk",
            "schema_validation_failed",
            "provider_error",
            "unsupported_provider",
        ],
    ),
    DataDictionaryField(
        name="fallback_used",
        type="boolean",
        description="是否使用保守降级卡片替代不可用或不可校验的真实 LLM 输出。",
        source="CandidateGenerationResult.fallback_used",
    ),
    DataDictionaryField(
        name="expert_preferred_move",
        type="enum",
        description="专家标注的更合适教师动作，用于计算系统承诺距离。",
        source="EpisodeLog.expert_preferred_move",
        allowed_values=["hold", "ask_for_evidence", "diagnostic_probe"],
    ),
    DataDictionaryField(
        name="commitment_distance",
        type="integer",
        description="系统动作相对专家偏好动作的承诺距离；正数表示更强，负数表示更弱。",
        source="EpisodeLog.commitment_distance",
        allowed_values=["-2", "-1", "0", "1", "2"],
    ),
    DataDictionaryField(
        name="harmful_over_commitment",
        type="boolean",
        description="人工标注该输出是否构成有害过度承诺。",
        source="EpisodeLog.harmful_over_commitment",
    ),
    DataDictionaryField(
        name="harmful_under_commitment",
        type="boolean",
        description="人工标注该输出是否构成有害承诺不足。",
        source="EpisodeLog.harmful_under_commitment",
    ),
    DataDictionaryField(
        name="answer_leakage",
        type="boolean",
        description="人工标注该输出是否泄露标准答案或过早纠正。",
        source="EpisodeLog.answer_leakage",
    ),
    DataDictionaryField(
        name="self_correction_support",
        type="integer",
        description="专家标注该输出支持学生自我修正的程度，1 到 5。",
        source="EpisodeLog.self_correction_support",
        allowed_values=["1", "2", "3", "4", "5"],
    ),
]


def list_data_dictionary() -> list[DataDictionaryField]:
    return DATA_DICTIONARY
