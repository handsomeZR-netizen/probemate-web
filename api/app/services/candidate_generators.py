import os
from dataclasses import dataclass
from typing import Protocol

from app.schemas.models import (
    AIProviderStatus,
    CandidateGenerationResult,
    CandidateOutput,
    GateMove,
    InputPack,
)
from app.services.llm_client import (
    AI_SCHEMA_VERSION,
    PROMPT_VERSION,
    JSONChatCompletionsClient,
    OpenAIProviderError,
    OpenAIResponsesClient,
    OpenAIValidationError,
)


MOCK_PROMPT_VERSION = "mock-v0.1"


@dataclass(frozen=True)
class AISettings:
    provider: str = "mock"
    model: str | None = None
    timeout_seconds: float = 4.5
    temperature: float = 0.2
    openai_api_key: str | None = None
    deepseek_api_key: str | None = None
    deepseek_base_url: str = "https://api.deepseek.com"


class CandidateGenerator(Protocol):
    def generate(self, input_pack: InputPack) -> CandidateGenerationResult:
        ...


def get_ai_settings() -> AISettings:
    timeout_text = os.getenv("AI_TIMEOUT_SECONDS", "4.5")
    temperature_text = os.getenv("AI_TEMPERATURE", "0.2")
    try:
        timeout_seconds = float(timeout_text)
    except ValueError:
        timeout_seconds = 4.5
    try:
        temperature = float(temperature_text)
    except ValueError:
        temperature = 0.2
    provider = os.getenv("AI_PROVIDER", "mock").strip().lower() or "mock"
    model = os.getenv("AI_MODEL") or None
    if provider == "deepseek":
        model = model or os.getenv("DEEPSEEK_MODEL") or "deepseek-v4-flash"
    return AISettings(
        provider=provider,
        model=model,
        timeout_seconds=timeout_seconds,
        temperature=temperature,
        openai_api_key=os.getenv("OPENAI_API_KEY") or None,
        deepseek_api_key=os.getenv("DEEPSEEK_API_KEY") or None,
        deepseek_base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
    )


def get_provider_status() -> AIProviderStatus:
    settings = get_ai_settings()
    if settings.provider == "mock":
        configured = True
    elif settings.provider == "openai":
        configured = bool(settings.openai_api_key and settings.model)
    elif settings.provider == "deepseek":
        configured = bool(settings.deepseek_api_key and settings.model)
    else:
        configured = False
    return AIProviderStatus(
        ai_provider=settings.provider,
        model_name=settings.model,
        configured=configured,
        fallback_available=True,
    )


def conservative_candidate_output(input_pack: InputPack, reason: str) -> CandidateOutput:
    quote = input_pack.student_answer.strip()
    return CandidateOutput.model_validate(
        {
            "candidate_explanations": [
                {
                    "label": "generation_unavailable",
                    "student_quotes": [quote],
                    "interpretation": "系统未获得可审计的结构化候选解释，因此不能给出诊断承诺。",
                    "missing_evidence": "需要先让学生补充理由或画出关键表征。",
                    "risk_if_overdiagnosed": "在 AI 输出不可用或不可校验时直接诊断会过强。",
                }
            ],
            "evidence_state": "ambiguous",
            "distinguishability": "needs_student_reason",
            "suggested_teacher_moves": [
                {
                    "move_type_hint": "ask_for_evidence",
                    "text": "请先补一句理由，或画出你用来判断的关键箭头。",
                    "answer_leakage_risk": "low",
                }
            ],
            "safety_notes": [f"AI 输出未被使用：{reason}。"],
        }
    )


def mock_candidate_generator(input_pack: InputPack) -> CandidateOutput:
    answer = input_pack.student_answer
    concept = input_pack.target_concept

    if "摩擦" in concept or "摩擦" in input_pack.question or "摩擦" in answer:
        return CandidateOutput.model_validate(
            {
                "candidate_explanations": [
                    {
                        "label": "friction_opposes_motion_overgeneralization",
                        "student_quotes": ["摩擦力总是阻碍运动"] if "摩擦力总是阻碍运动" in answer else [answer],
                        "interpretation": "学生可能把摩擦力概括为总是与运动方向相反。",
                        "missing_evidence": "需要确认学生是否区分相对运动趋势和实际运动方向。",
                        "risk_if_overdiagnosed": "如果学生只是口语化表达，直接贴标签会过强。",
                    }
                ],
                "evidence_state": "sufficient",
                "distinguishability": "short_probe_can_distinguish",
                "suggested_teacher_moves": [
                    {
                        "move_type_hint": "diagnostic_probe",
                        "text": "如果书受到向后的摩擦力，是什么让书跟着箱子一起向前运动？",
                        "answer_leakage_risk": "low",
                    }
                ],
                "safety_notes": ["不要用“你混淆了”作为开头。"],
            }
        )

    if "更重" in answer or "铁球" in input_pack.question:
        return CandidateOutput.model_validate(
            {
                "candidate_explanations": [
                    {
                        "label": "heavier_object_falls_faster",
                        "student_quotes": ["更重"] if "更重" in answer else [answer],
                        "interpretation": "学生可能持有重物下落更快的直觉。",
                        "missing_evidence": "需要确认这是探究前预测还是演示后的解释。",
                        "risk_if_overdiagnosed": "探究开始前保留直觉可能比立即纠正更合适。",
                    }
                ],
                "evidence_state": "ambiguous",
                "distinguishability": "needs_observation_or_reason",
                "suggested_teacher_moves": [
                    {
                        "move_type_hint": "ask_for_evidence",
                        "text": "你说更重会先落地，能补一句你认为更重会怎样影响下落过程吗？",
                        "answer_leakage_risk": "low",
                    }
                ],
                "safety_notes": ["探究开始前不要过早纠正。"],
            }
        )

    quote = "还在往前走" if "还在往前走" in answer else answer
    practiced_deceleration = bool(input_pack.prior_context.get("has_practiced_deceleration"))
    evidence_state = (
        "sufficient"
        if ("速度变小" in answer or "变化量" in answer or (practiced_deceleration and "还在往前走" in answer))
        else "ambiguous"
    )
    hint = "diagnostic_probe" if evidence_state == "sufficient" else "ask_for_evidence"
    text = (
        "如果速度箭头在变短，速度变化量指向哪里？"
        if evidence_state == "sufficient"
        else "请画出此刻速度箭头和下一秒速度箭头，比较速度变化量方向。"
    )
    return CandidateOutput.model_validate(
        {
            "candidate_explanations": [
                {
                    "label": "possible_velocity_acceleration_confusion",
                    "student_quotes": [quote],
                    "interpretation": "学生可能把运动方向当作加速度方向，也可能只是没有表达速度变化量。",
                    "missing_evidence": "尚未稳定说明速度变化量方向。",
                    "risk_if_overdiagnosed": "可能把表达不完整误判为稳定误概念。",
                }
            ],
            "evidence_state": evidence_state,
            "distinguishability": "needs_representation",
            "suggested_teacher_moves": [
                {
                    "move_type_hint": hint,
                    "text": text,
                    "answer_leakage_risk": "low",
                }
            ],
            "safety_notes": ["先追证据，不要直接说学生混淆速度和加速度。"],
        }
    )


class MockCandidateGenerator:
    def generate(self, input_pack: InputPack) -> CandidateGenerationResult:
        return CandidateGenerationResult(
            candidate_output=mock_candidate_generator(input_pack),
            ai_provider="mock",
            prompt_version=MOCK_PROMPT_VERSION,
            ai_schema_version=AI_SCHEMA_VERSION,
        )


class OpenAICandidateGenerator:
    def __init__(self, settings: AISettings) -> None:
        self.settings = settings
        self.client = OpenAIResponsesClient(
            api_key=settings.openai_api_key,
            model=settings.model,
            timeout_seconds=settings.timeout_seconds,
            temperature=settings.temperature,
        )

    def generate(self, input_pack: InputPack) -> CandidateGenerationResult:
        try:
            candidate_output = self.client.generate_candidate_output(input_pack)
            return CandidateGenerationResult(
                candidate_output=candidate_output,
                ai_provider="openai",
                model_name=self.settings.model,
                prompt_version=PROMPT_VERSION,
                ai_schema_version=AI_SCHEMA_VERSION,
            )
        except OpenAIValidationError as exc:
            return CandidateGenerationResult(
                candidate_output=conservative_candidate_output(input_pack, "schema_validation_failed"),
                ai_provider="openai",
                model_name=self.settings.model,
                prompt_version=PROMPT_VERSION,
                ai_schema_version=AI_SCHEMA_VERSION,
                raw_llm_valid=False,
                validation_error=str(exc),
                fallback_used=True,
                downgrade_reason="schema_validation_failed",
            )
        except OpenAIProviderError as exc:
            return CandidateGenerationResult(
                candidate_output=conservative_candidate_output(input_pack, "provider_error"),
                ai_provider="openai",
                model_name=self.settings.model,
                prompt_version=PROMPT_VERSION,
                ai_schema_version=AI_SCHEMA_VERSION,
                raw_llm_valid=False,
                provider_error=str(exc),
                fallback_used=True,
                downgrade_reason="provider_error",
            )


class DeepSeekCandidateGenerator:
    def __init__(self, settings: AISettings) -> None:
        self.settings = settings
        self.client = JSONChatCompletionsClient(
            api_key=settings.deepseek_api_key,
            model=settings.model,
            base_url=settings.deepseek_base_url,
            timeout_seconds=settings.timeout_seconds,
            temperature=settings.temperature,
            api_key_name="DEEPSEEK_API_KEY",
        )

    def generate(self, input_pack: InputPack) -> CandidateGenerationResult:
        try:
            candidate_output = self.client.generate_candidate_output(input_pack)
            return CandidateGenerationResult(
                candidate_output=candidate_output,
                ai_provider="deepseek",
                model_name=self.settings.model,
                prompt_version=PROMPT_VERSION,
                ai_schema_version=AI_SCHEMA_VERSION,
            )
        except OpenAIValidationError as exc:
            return CandidateGenerationResult(
                candidate_output=conservative_candidate_output(input_pack, "schema_validation_failed"),
                ai_provider="deepseek",
                model_name=self.settings.model,
                prompt_version=PROMPT_VERSION,
                ai_schema_version=AI_SCHEMA_VERSION,
                raw_llm_valid=False,
                validation_error=str(exc),
                fallback_used=True,
                downgrade_reason="schema_validation_failed",
            )
        except OpenAIProviderError as exc:
            return CandidateGenerationResult(
                candidate_output=conservative_candidate_output(input_pack, "provider_error"),
                ai_provider="deepseek",
                model_name=self.settings.model,
                prompt_version=PROMPT_VERSION,
                ai_schema_version=AI_SCHEMA_VERSION,
                raw_llm_valid=False,
                provider_error=str(exc),
                fallback_used=True,
                downgrade_reason="provider_error",
            )


class UnsupportedCandidateGenerator:
    def __init__(self, settings: AISettings) -> None:
        self.settings = settings

    def generate(self, input_pack: InputPack) -> CandidateGenerationResult:
        return CandidateGenerationResult(
            candidate_output=conservative_candidate_output(input_pack, "unsupported_provider"),
            ai_provider=self.settings.provider,
            model_name=self.settings.model,
            raw_llm_valid=False,
            provider_error=f"Unsupported AI_PROVIDER: {self.settings.provider}",
            fallback_used=True,
            downgrade_reason="unsupported_provider",
        )


def get_candidate_generator() -> CandidateGenerator:
    settings = get_ai_settings()
    if settings.provider == "mock":
        return MockCandidateGenerator()
    if settings.provider == "openai":
        return OpenAICandidateGenerator(settings)
    if settings.provider == "deepseek":
        return DeepSeekCandidateGenerator(settings)
    return UnsupportedCandidateGenerator(settings)
