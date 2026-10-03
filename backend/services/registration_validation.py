import re
from datetime import date, datetime, timedelta, timezone
from typing import Any


HOSPITAL_TIME_ZONE = timezone(timedelta(hours=5, minutes=30))


CORE_REQUIRED_QUESTIONS: tuple[dict[str, Any], ...] = (
    {
        "id": "full_name",
        "question": "Could you tell me your full name?",
        "required": True,
        "enabled": True,
    },
    {
        "id": "date_of_birth",
        "question": "What is your date of birth?",
        "required": True,
        "enabled": True,
    },
    {
        "id": "gender",
        "question": "What is your gender?",
        "required": True,
        "enabled": True,
    },
    {
        "id": "phone",
        "question": "What is the best mobile number to reach you?",
        "required": True,
        "enabled": True,
    },
    {
        "id": "visit_reason",
        "question": "What brings you to the hospital today?",
        "required": True,
        "enabled": True,
    },
)


def ensure_core_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep identity and contact questions mandatory, even with stale client settings."""
    configured = {question["id"]: question for question in questions}
    core_ids = {question["id"] for question in CORE_REQUIRED_QUESTIONS}
    ordered = []

    for core_question in CORE_REQUIRED_QUESTIONS:
        question = configured.get(core_question["id"], core_question)
        wording = question["question"]
        has_wording = (
            bool(wording.strip())
            if isinstance(wording, str)
            else any(isinstance(value, str) and value.strip() for value in wording.values())
        )
        ordered.append(
            {
                **question,
                "question": wording if has_wording else core_question["question"],
                "required": True,
                "enabled": True,
            }
        )

    ordered.extend(
        question
        for question in questions
        if question["enabled"] and question["id"] not in core_ids and question["id"] != "age"
    )
    return ordered


def normalize_core_value(field_id: str, value: Any) -> str | None:
    """Return a normalized, valid core-field value or None when it needs clarification."""
    if value is None or isinstance(value, bool):
        return None
    if not isinstance(value, str):
        if field_id != "phone" or not isinstance(value, (int, float)):
            return None
        value = str(value)

    cleaned = value.strip()
    if not cleaned:
        return None

    if field_id == "date_of_birth":
        try:
            parsed = date.fromisoformat(cleaned)
        except ValueError:
            return None
        today = datetime.now(HOSPITAL_TIME_ZONE).date()
        return parsed.isoformat() if parsed <= today else None

    if field_id == "phone":
        digits = re.sub(r"\D", "", cleaned)
        return digits if 7 <= len(digits) <= 15 else None

    return cleaned


def invalid_core_fields(patient_data: dict[str, Any]) -> list[str]:
    return [
        question["id"]
        for question in CORE_REQUIRED_QUESTIONS
        if normalize_core_value(question["id"], patient_data.get(question["id"])) is None
    ]


def calculate_age(date_of_birth: str, today: date | None = None) -> int:
    birth_date = date.fromisoformat(date_of_birth)
    current_date = today or datetime.now(HOSPITAL_TIME_ZONE).date()
    age = current_date.year - birth_date.year
    if (current_date.month, current_date.day) < (birth_date.month, birth_date.day):
        age -= 1
    return age


def normalize_patient_data(patient_data: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(patient_data)
    for question in CORE_REQUIRED_QUESTIONS:
        field_id = question["id"]
        value = normalize_core_value(field_id, normalized.get(field_id))
        if value is not None:
            normalized[field_id] = value
    dob = normalized.get("date_of_birth")
    if isinstance(dob, str):
        normalized["age"] = str(calculate_age(dob))
    return normalized
