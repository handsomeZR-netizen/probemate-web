import os

from app.schemas.models import DataGovernancePolicy


def get_data_governance_policy() -> DataGovernancePolicy:
    retention_text = os.getenv("DATA_RETENTION_DAYS", "180")
    try:
        retention_days = int(retention_text)
    except ValueError:
        retention_days = 180
    return DataGovernancePolicy(
        student_notice=(
            "短答用于帮助教师选择下一步追问和研究复盘；学生端不显示个人误概念标签，"
            "导出默认去标识化。"
        ),
        retention_days=retention_days,
    )
