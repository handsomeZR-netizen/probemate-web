from collections import Counter

from app.schemas.models import EpisodeLog, ResearchEvidenceSummary
from app.services.store import store


def build_research_evidence_summary(logs: list[EpisodeLog] | None = None) -> ResearchEvidenceSummary:
    rows = logs if logs is not None else store.list_episode_logs()
    provider_counts = Counter(log.ai_provider for log in rows)
    condition_counts = Counter(log.condition for log in rows)
    downgrade_counts = Counter(log.downgrade_reason for log in rows if log.downgrade_reason)
    return ResearchEvidenceSummary(
        total_episodes=len(rows),
        real_llm_runs=sum(1 for log in rows if log.ai_provider in {"openai", "deepseek"}),
        mock_runs=provider_counts.get("mock", 0),
        baseline_runs=provider_counts.get("baseline", 0),
        fallback_count=sum(1 for log in rows if log.fallback_used),
        invalid_llm_count=sum(1 for log in rows if not log.raw_llm_valid),
        evidence_first_actions=sum(
            1
            for log in rows
            if log.system_move in {"ask_for_evidence", "hold"}
            or log.downgrade_reason in {"no_valid_quote", "evidence_ambiguous", "answer_leakage_risk", "bad_timing"}
        ),
        bad_timing_holds=downgrade_counts.get("bad_timing", 0),
        no_quote_downgrades=downgrade_counts.get("no_valid_quote", 0),
        answer_leakage_downgrades=downgrade_counts.get("answer_leakage_risk", 0),
        teacher_edits=sum(1 for log in rows if log.teacher_action == "edit"),
        teacher_delays=sum(1 for log in rows if log.teacher_action == "delay"),
        harmful_over_commitment=sum(1 for log in rows if log.harmful_over_commitment is True),
        harmful_under_commitment=sum(1 for log in rows if log.harmful_under_commitment is True),
        provider_counts=dict(provider_counts),
        condition_counts=dict(condition_counts),
        downgrade_counts=dict(downgrade_counts),
    )
