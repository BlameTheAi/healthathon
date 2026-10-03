import re
from datetime import date
from typing import Any

from models.registration import ConversationResponse, NextQuestion
from services.gemini_service import generate_structured_response
from services.registration_validation import (
    CORE_REQUIRED_QUESTIONS,
    ensure_core_questions,
    normalize_core_value,
)


class InvalidStructuredResponseError(Exception):
    pass


_MARKDOWN_PATTERN = re.compile(r"[*_`#>~]+")

CLOSING_FALLBACK = "Thank you, that's everything I need. A member of our staff will be with you shortly."
_CORE_FIELD_IDS = {question["id"] for question in CORE_REQUIRED_QUESTIONS}
_MONTHS = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}


def _sanitize_spoken_text(text: str) -> str:
    """Defensive second layer so TTS never reads stray markdown symbols aloud."""
    cleaned = _MARKDOWN_PATTERN.sub("", text)
    return re.sub(r"\s{2,}", " ", cleaned).strip()


def _question_text(question: dict[str, Any], language: str) -> str:
    wording = question["question"]
    if isinstance(wording, str):
        return wording
    language_key = language[:2]
    return wording.get(language_key) or wording.get("en") or next(iter(wording.values()), "")


def _clean_value(value: Any) -> Any:
    """Blank strings count as unknown, same as null."""
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    return value


def _day_month_without_year(text: str) -> tuple[int, int] | None:
    normalized = text.lower().strip()
    normalized = re.sub(r"\b(\d{1,2})(st|nd|rd|th)\b", r"\1", normalized)
    normalized = re.sub(r"\bof\b", " ", normalized)

    month_pattern = "|".join(sorted(_MONTHS, key=len, reverse=True))
    day_month = re.search(rf"\b(\d{{1,2}})\s+({month_pattern})\b", normalized)
    month_day = re.search(rf"\b({month_pattern})\s+(\d{{1,2}})\b", normalized)
    if day_month:
        day, month = int(day_month.group(1)), _MONTHS[day_month.group(2)]
    elif month_day:
        month, day = _MONTHS[month_day.group(1)], int(month_day.group(2))
    else:
        numeric = re.search(r"\b(\d{1,2})[/-](\d{1,2})\b", normalized)
        if not numeric:
            return None
        day, month = int(numeric.group(1)), int(numeric.group(2))

    try:
        date(2000, month, day)
    except ValueError:
        return None
    return month, day


def _year_only(text: str) -> int | None:
    normalized = text.strip()
    match = re.fullmatch(r"(?:the year is\s+)?(\d{4})[.!]?", normalized, re.IGNORECASE)
    if not match:
        return None
    year = int(match.group(1))
    this_year = date.today().year
    return year if this_year - 120 <= year <= this_year else None


def _partial_birth_date_before_year_answer(
    conversation: list[dict[str, str]],
) -> tuple[int, int] | None:
    if len(conversation) < 3 or conversation[-1]["role"] != "patient":
        return None
    clarification = conversation[-2]
    if clarification["role"] != "assistant" or not re.search(
        r"\b(year|born|birth)\b", clarification["text"], re.IGNORECASE
    ):
        return None

    for turn in reversed(conversation[:-2]):
        if turn["role"] == "patient":
            return _day_month_without_year(turn["text"])
    return None


def _gender_from_short_answer(text: str) -> str | None:
    normalized = re.sub(r"[^a-z ]", " ", text.lower())
    normalized = " ".join(normalized.split())
    answers = {
        "male": "Male",
        "mail": "Male",
        "man": "Male",
        "female": "Female",
        "woman": "Female",
        "other": "Other",
        "nonbinary": "Non-binary",
        "non binary": "Non-binary",
    }
    return answers.get(normalized)


def _gender_was_asked(conversation: list[dict[str, str]]) -> bool:
    last_assistant_prompt = next(
        (turn["text"] for turn in reversed(conversation) if turn["role"] == "assistant"),
        "",
    )
    return bool(re.search(r"\b(gender|sex)\b|लिंग|લિંગ", last_assistant_prompt, re.IGNORECASE))


def _short_name_from_answer(text: str) -> str | None:
    words = [
        re.sub(r"^[^\w'-]+|[^\w'-]+$", "", word)
        for word in text.split()
    ]
    words = [word for word in words if word]
    if len(words) == 2 and words[0].casefold() == words[1].casefold():
        words.pop()
    if len(words) != 1:
        return None

    word = words[0]
    if word.casefold() in {
        "yes", "yeah", "yep", "yup", "no", "nope", "nah",
        "male", "female", "man", "woman", "other",
    }:
        return None
    return word.capitalize() if word.islower() or word.isupper() else word


def _name_was_asked(conversation: list[dict[str, str]]) -> bool:
    last_assistant_prompt = next(
        (turn["text"] for turn in reversed(conversation) if turn["role"] == "assistant"),
        "",
    )
    return bool(re.search(r"\bname\b|what should we call you", last_assistant_prompt, re.IGNORECASE))


def _yes_no_from_short_answer(text: str) -> str | None:
    normalized = re.sub(r"[^a-z ]", " ", text.lower())
    normalized = " ".join(normalized.split())
    if normalized in {"yes", "yeah", "yep", "yup", "sure", "correct", "affirmative"}:
        return "Yes"
    if normalized in {"no", "nope", "nah", "negative", "not really"}:
        return "No"
    return None


def _is_yes_no_question(question: dict[str, Any]) -> bool:
    question_id = question["id"].lower()
    if question_id.startswith(("previous_", "has_", "is_", "did_", "do_", "can_", "referral")):
        return True

    wording = question["question"]
    texts = [wording] if isinstance(wording, str) else list(wording.values())
    yes_no_pattern = re.compile(
        r"^\s*(?:do|does|did|is|are|was|were|have|has|had|can|could|would|will|"
        r"should|hasn't|haven't|don't|doesn't|didn't)\b",
        re.IGNORECASE,
    )
    open_ended_request = re.compile(
        r"^\s*(?:could|would)\s+you\s+(?:tell|share|provide|give|spell|state|describe|explain|say)\b",
        re.IGNORECASE,
    )
    return any(
        isinstance(text, str)
        and yes_no_pattern.search(text)
        and not open_ended_request.search(text)
        for text in texts
    )


def process_conversation(
    *,
    language: str,
    conversation: list[dict[str, str]],
    questions: list[dict[str, Any]],
    current_state: dict[str, Any] | None = None,
) -> ConversationResponse:
    question_ids = [question["id"] for question in questions]
    if len(set(question_ids)) != len(question_ids):
        raise InvalidStructuredResponseError("Question IDs must be unique.")

    enabled = ensure_core_questions(questions)
    if not enabled:
        raise InvalidStructuredResponseError("No enabled registration questions were supplied.")
    field_ids = [question["id"] for question in enabled]

    prior = {}
    for field_id in field_ids:
        value = _clean_value((current_state or {}).get(field_id))
        prior[field_id] = normalize_core_value(field_id, value) if field_id in _CORE_FIELD_IDS else value

    required_ids = [question["id"] for question in enabled if question["required"]]
    missing_before = [field_id for field_id in required_ids if prior[field_id] is None]
    latest_patient = next(
        (turn["text"] for turn in reversed(conversation) if turn["role"] == "patient"),
        "",
    )

    if missing_before and missing_before[0] == "date_of_birth":
        previous_partial = _partial_birth_date_before_year_answer(conversation)
        year = _year_only(latest_patient)
        if previous_partial and year:
            month, day = previous_partial
            try:
                candidate = date(year, month, day).isoformat()
            except ValueError:
                candidate = ""
            if candidate and normalize_core_value("date_of_birth", candidate):
                prior["date_of_birth"] = candidate

        if prior["date_of_birth"] is None:
            partial = _day_month_without_year(latest_patient)
            if partial and not re.search(r"\b(?:19|20)\d{2}\b", latest_patient):
                month, day = partial
                next_question = NextQuestion(
                    id="date_of_birth",
                    text="What year were you born?",
                )
                return ConversationResponse(
                    spoken_reply=next_question.text,
                    detected_correction=False,
                    corrected_fields=[],
                    is_registration_complete=False,
                    extracted_information=prior,
                    next_question=next_question,
                    missing_required_fields=missing_before,
                )

    short_yes_no = _yes_no_from_short_answer(latest_patient)
    binary_target = next(
        (
            question
            for question in enabled
            if question["id"] == (missing_before[0] if missing_before else None)
            and _is_yes_no_question(question)
        ),
        None,
    )

    name_targeted = _name_was_asked(conversation)
    short_name = _short_name_from_answer(latest_patient) if name_targeted else None
    gender_targeted = (missing_before and missing_before[0] == "gender") or _gender_was_asked(conversation)
    explicit_gender = _gender_from_short_answer(latest_patient) if gender_targeted else None

    if short_name or explicit_gender:
        direct_state = dict(prior)
        if short_name:
            direct_state["full_name"] = short_name
        if explicit_gender:
            direct_state["gender"] = explicit_gender
        generated = {
            "spoken_reply": "",
            "detected_correction": any(
                prior[field_id] is not None and prior[field_id] != direct_state[field_id]
                for field_id in ("full_name", "gender")
                if direct_state.get(field_id) is not None
            ),
            "is_registration_complete": False,
            "next_question_id": None,
            "current_extracted_data": direct_state,
        }
    else:
        generated = generate_structured_response(
            conversation=conversation,
            questions=enabled,
            current_state=prior,
        )

    if binary_target and short_yes_no:
        generated["current_extracted_data"][binary_target["id"]] = short_yes_no

    # Merge: the latest non-null value wins; null never erases an earlier answer.
    merged = dict(prior)
    corrected_fields: list[str] = []
    for field_id in field_ids:
        new_value = _clean_value(generated["current_extracted_data"].get(field_id))
        if field_id in _CORE_FIELD_IDS:
            new_value = normalize_core_value(field_id, new_value)
        if new_value is None:
            continue
        if prior[field_id] is not None and prior[field_id] != new_value:
            corrected_fields.append(field_id)
        merged[field_id] = new_value

    missing = [question["id"] for question in enabled if question["required"] and merged[question["id"]] is None]
    spoken = _sanitize_spoken_text(generated["spoken_reply"])

    next_question = None
    if missing:
        target = next(question for question in enabled if question["id"] == missing[0])
        # Use the model's warm reply only when it targets the field we actually need next.
        if generated["next_question_id"] == target["id"] and spoken:
            reply = spoken
        else:
            reply = _sanitize_spoken_text(_question_text(target, language))
        next_question = NextQuestion(id=target["id"], text=reply)
    else:
        reply = spoken or CLOSING_FALLBACK

    return ConversationResponse(
        spoken_reply=reply,
        detected_correction=generated["detected_correction"],
        corrected_fields=corrected_fields,
        is_registration_complete=not missing,
        extracted_information=merged,
        next_question=next_question,
        missing_required_fields=missing,
    )
