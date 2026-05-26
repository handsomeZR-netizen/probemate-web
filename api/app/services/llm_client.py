import json
import os
from pathlib import Path
from typing import Any

import httpx
from pydantic import ValidationError

from app.schemas.models import CandidateOutput, GateMove, InputPack


PROMPT_VERSION = "candidate-generation-v0.1"
AI_SCHEMA_VERSION = "candidate-output-v0.1"


class LLMProviderError(RuntimeError):
    pass


class LLMValidationError(RuntimeError):
    pass


CANDIDATE_OUTPUT_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "candidate_explanations",
        "evidence_state",
        "distinguishability",
        "suggested_teacher_moves",
        "safety_notes",
    ],
    "properties": {
        "candidate_explanations": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "label",
                    "student_quotes",
                    "interpretation",
                    "missing_evidence",
                    "risk_if_overdiagnosed",
                ],
                "properties": {
                    "label": {"type": "string"},
                    "student_quotes": {
                        "type": "array",
                        "minItems": 1,
                        "items": {"type": "string"},
                    },
                    "interpretation": {"type": "string"},
                    "missing_evidence": {"type": "string"},
                    "risk_if_overdiagnosed": {"type": "string"},
                },
            },
        },
        "evidence_state": {"type": "string", "enum": ["none", "ambiguous", "sufficient"]},
        "distinguishability": {"type": "string"},
        "suggested_teacher_moves": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["move_type_hint", "text", "answer_leakage_risk"],
                "properties": {
                    "move_type_hint": {
                        "type": "string",
                        "enum": [
                            GateMove.HOLD.value,
                            GateMove.ASK_FOR_EVIDENCE.value,
                            GateMove.DIAGNOSTIC_PROBE.value,
                        ],
                    },
                    "text": {"type": "string"},
                    "answer_leakage_risk": {
                        "type": "string",
                        "enum": ["low", "medium", "high"],
                    },
                },
            },
        },
        "safety_notes": {"type": "array", "items": {"type": "string"}},
    },
}


def load_candidate_generation_prompt() -> str:
    prompt_path = Path(__file__).resolve().parents[1] / "prompts" / "candidate_generation_v0_1.md"
    return prompt_path.read_text(encoding="utf-8")


def extract_output_text(response_payload: dict[str, Any]) -> str:
    output_text = response_payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    chunks: list[str] = []
    for item in response_payload.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if isinstance(content, dict) and content.get("type") == "output_text":
                text = content.get("text")
                if isinstance(text, str):
                    chunks.append(text)
    if chunks:
        return "".join(chunks)
    raise LLMValidationError("OpenAI response did not contain output_text")


def extract_chat_completion_text(response_payload: dict[str, Any]) -> str:
    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise LLMValidationError("Chat completion response did not contain choices")
    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise LLMValidationError("Chat completion choice was not an object")
    message = first_choice.get("message")
    if not isinstance(message, dict):
        raise LLMValidationError("Chat completion choice did not contain a message")
    content = message.get("content")
    if not isinstance(content, str) or not content.strip():
        raise LLMValidationError("Chat completion message did not contain content")
    return content


def candidate_output_json_instructions() -> str:
    return (
        "Return JSON only. The JSON object must match this shape exactly: "
        "{"
        '"candidate_explanations":[{"label":"string","student_quotes":["exact quote from student answer"],'
        '"interpretation":"string","missing_evidence":"string","risk_if_overdiagnosed":"string"}],'
        '"evidence_state":"none|ambiguous|sufficient",'
        '"distinguishability":"string",'
        '"suggested_teacher_moves":[{"move_type_hint":"hold|ask_for_evidence|diagnostic_probe",'
        '"text":"string","answer_leakage_risk":"low|medium|high"}],'
        '"safety_notes":["string"]'
        "}"
    )


class OpenAIResponsesClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        timeout_seconds: float = 4.5,
        temperature: float = 0.2,
    ) -> None:
        self.api_key = api_key or os.getenv("OPENAI_API_KEY")
        self.model = model or os.getenv("AI_MODEL")
        self.timeout_seconds = timeout_seconds
        self.temperature = temperature

    def generate_candidate_output(self, input_pack: InputPack) -> CandidateOutput:
        if not self.api_key:
            raise LLMProviderError("OPENAI_API_KEY is not configured")
        if not self.model:
            raise LLMProviderError("AI_MODEL is not configured")

        payload = {
            "model": self.model,
            "input": [
                {"role": "system", "content": load_candidate_generation_prompt()},
                {
                    "role": "user",
                    "content": json.dumps(input_pack.model_dump(mode="json"), ensure_ascii=False),
                },
            ],
            "temperature": self.temperature,
            "text": {
                "format": {
                    "type": "json_schema",
                    "name": "candidate_output",
                    "description": "ProbeMate candidate explanations grounded in student quotes.",
                    "strict": True,
                    "schema": CANDIDATE_OUTPUT_JSON_SCHEMA,
                }
            },
        }

        try:
            response = httpx.post(
                "https://api.openai.com/v1/responses",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise LLMProviderError("timeout") from exc
        except httpx.HTTPStatusError as exc:
            message = exc.response.text[:500] if exc.response is not None else str(exc)
            raise LLMProviderError(f"http_error: {message}") from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(str(exc)) from exc

        try:
            raw_payload = json.loads(extract_output_text(response.json()))
            return CandidateOutput.model_validate(raw_payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise LLMValidationError(str(exc)) from exc


class JSONChatCompletionsClient:
    def __init__(
        self,
        api_key: str | None,
        model: str | None,
        base_url: str,
        timeout_seconds: float = 4.5,
        temperature: float = 0.2,
        api_key_name: str = "API key",
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.timeout_seconds = timeout_seconds
        self.temperature = temperature
        self.api_key_name = api_key_name

    def generate_candidate_output(self, input_pack: InputPack) -> CandidateOutput:
        if not self.api_key:
            raise LLMProviderError(f"{self.api_key_name} is not configured")
        if not self.model:
            raise LLMProviderError("AI model is not configured")

        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": f"{load_candidate_generation_prompt()}\n\n{candidate_output_json_instructions()}",
                },
                {
                    "role": "user",
                    "content": json.dumps(input_pack.model_dump(mode="json"), ensure_ascii=False),
                },
            ],
            "temperature": self.temperature,
            "response_format": {"type": "json_object"},
            "stream": False,
        }

        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout_seconds,
            )
            response.raise_for_status()
        except httpx.TimeoutException as exc:
            raise LLMProviderError("timeout") from exc
        except httpx.HTTPStatusError as exc:
            message = exc.response.text[:500] if exc.response is not None else str(exc)
            raise LLMProviderError(f"http_error: {message}") from exc
        except httpx.HTTPError as exc:
            raise LLMProviderError(str(exc)) from exc

        try:
            raw_payload = json.loads(extract_chat_completion_text(response.json()))
            return CandidateOutput.model_validate(raw_payload)
        except (json.JSONDecodeError, ValidationError) as exc:
            raise LLMValidationError(str(exc)) from exc


OpenAIProviderError = LLMProviderError
OpenAIValidationError = LLMValidationError
