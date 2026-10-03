import json
import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors

from prompts.registration_prompt import REGISTRATION_SYSTEM_INSTRUCTION


load_dotenv(Path(__file__).resolve().parents[1] / ".env")

_SCALAR_TYPES = (str, bool, int, float)


class GeminiRateLimitError(Exception):
    pass


class GeminiUnavailableError(Exception):
    pass


class InvalidGeminiResponseError(Exception):
    pass


def _strip_fences(text: str) -> str:
    """Gemini sometimes wraps JSON in ```json ... ``` even when told not to."""
    text = text.strip()
    if text.startswith("```"):
        first_newline = text.find("\n")
        if first_newline != -1:
            text = text[first_newline + 1 :]
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


def _extract_json_object(text: str) -> str:
    """Pull a JSON object out of the raw model text, tolerating stray commentary."""
    text = _strip_fences(text)
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    if start == -1:
        raise InvalidGeminiResponseError("No JSON object found in the model's response.")

    depth = 0
    for index in range(start, len(text)):
        character = text[index]
        if character == "{":
            depth += 1
        elif character == "}":
            depth -= 1
            if depth == 0:
                return text[start : index + 1]

    raise InvalidGeminiResponseError("Unbalanced JSON object in the model's response.")


def _english_wording(question: dict[str, Any]) -> str:
    wording = question["question"]
    if isinstance(wording, str):
        return wording
    return wording.get("en") or next(iter(wording.values()), "")


def _validate_gemini_payload(payload: Any, field_ids: set[str]) -> dict[str, Any]:
    """Validates the model's output. Unknown fields are dropped, not stored."""
    if not isinstance(payload, dict):
        raise InvalidGeminiResponseError("Gemini response must be an object.")

    spoken_reply = payload.get("spoken_reply")
    detected_correction = payload.get("detected_correction")
    is_complete = payload.get("is_registration_complete")
    next_question_id = payload.get("next_question_id") or None
    extracted = payload.get("current_extracted_data")

    if not isinstance(spoken_reply, str):
        raise InvalidGeminiResponseError("spoken_reply must be a string.")
    if not isinstance(detected_correction, bool):
        raise InvalidGeminiResponseError("detected_correction must be a boolean.")
    if not isinstance(is_complete, bool):
        raise InvalidGeminiResponseError("is_registration_complete must be a boolean.")
    if not isinstance(extracted, dict):
        raise InvalidGeminiResponseError("current_extracted_data must be an object.")

    if not isinstance(next_question_id, str) or next_question_id not in field_ids:
        next_question_id = None

    cleaned: dict[str, Any] = {field_id: None for field_id in field_ids}
    for key, value in extracted.items():
        if key not in field_ids:
            print(f"[gemini] ignored unconfigured field {key!r}", flush=True)
            continue
        if value is None or isinstance(value, _SCALAR_TYPES):
            cleaned[key] = value

    return {
        "spoken_reply": spoken_reply,
        "detected_correction": detected_correction,
        "is_registration_complete": is_complete,
        "next_question_id": next_question_id,
        "current_extracted_data": cleaned,
    }


def _build_prompt(
    *,
    questions: list[dict[str, Any]],
    current_state: dict[str, Any],
    conversation: list[dict[str, str]],
) -> str:
    field_ids = [question["id"] for question in questions]
    required_ids = [question["id"] for question in questions if question["required"]]
    unknown_required = [field_id for field_id in required_ids if current_state.get(field_id) is None]
    latest_patient = next(
        (turn["text"] for turn in reversed(conversation) if turn["role"] == "patient"),
        "",
    )
    wording = {question["id"]: _english_wording(question) for question in questions}

    return f"""Continue the spoken, hands-free registration conversation. Speaking language is English only.

Field IDs, in the order they should be asked: {json.dumps(field_ids)}
Required field IDs, in order: {json.dumps(required_ids)}
Reference wording for each field (rephrase warmly; same field; English only): {json.dumps(wording, ensure_ascii=False)}

Already recorded before this message (cumulative state): {json.dumps(current_state, ensure_ascii=False)}
Required fields still unknown before this message: {json.dumps(unknown_required)}

Conversation so far (role "assistant" is you, role "patient" is the patient):
{json.dumps(conversation, ensure_ascii=False)}

Patient's latest message, to process now:
{json.dumps(latest_patient, ensure_ascii=False)}

Return only the JSON object described in your instructions."""


def _call_gemini(model: str, prompt: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiUnavailableError("Gemini API key is not configured.")

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config={
                "system_instruction": REGISTRATION_SYSTEM_INSTRUCTION,
                "response_mime_type": "application/json",
                "temperature": 0,
                "max_output_tokens": 2048,
            },
        )
        text = response.text or ""
        if not text.strip():
            raise InvalidGeminiResponseError("Gemini returned an empty response.")
        return text
    except genai_errors.APIError as error:
        code = str(getattr(error, "code", ""))
        if code == "429":
            raise GeminiRateLimitError from error
        raise GeminiUnavailableError(f"Gemini API error {code}: {error}") from error
    except InvalidGeminiResponseError:
        raise
    except Exception as error:
        raise GeminiUnavailableError(f"{type(error).__name__}: {error}") from error


def generate_structured_response(
    *,
    conversation: list[dict[str, str]],
    questions: list[dict[str, Any]],
    current_state: dict[str, Any],
) -> dict[str, Any]:
    """Runs one turn of the conversation and returns validated model output.

    `current_state` is the cumulative state the frontend holds, so the model
    can see what is already recorded and overwrite it when the patient corrects
    themselves. The backend merges the result; the model never owns the state.
    """
    field_ids = {question["id"] for question in questions}
    model = os.getenv("GEMINI_MODEL", "gemini-flash-lite-latest").strip() or "gemini-flash-lite-latest"
    prompt = _build_prompt(questions=questions, current_state=current_state, conversation=conversation)

    last_error: Exception | None = None
    raw_text = ""
    for attempt in range(2):
        try:
            raw_text = _call_gemini(model, prompt)
            cleaned = _extract_json_object(raw_text)
            return _validate_gemini_payload(json.loads(cleaned), field_ids)
        except (InvalidGeminiResponseError, json.JSONDecodeError) as error:
            last_error = error
            print(f"[gemini] attempt {attempt + 1} failed: {error}", flush=True)
            if raw_text:
                print(f"[gemini] raw response: {raw_text[:800]}", flush=True)
            continue

    raise InvalidGeminiResponseError(str(last_error) if last_error else "Gemini returned invalid structured data.")
