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
        name="gate_reasons",
        type="string[]",
        description="gate 选择 Hold/Ask/Probe 的规则化原因。",
        source="GateDecision.gate_reasons",
    ),
]


def list_data_dictionary() -> list[DataDictionaryField]:
    return DATA_DICTIONARY
