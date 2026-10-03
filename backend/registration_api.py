"""The async queue API that connects the Patient Kiosk to the Staff Dashboard.

Two devices, one shared backend, no shared screen:

  * ``POST /api/registration/submit``  - the kiosk hands off a finished
    conversation. The patient never sees what staff see.
  * ``GET  /api/staff/queue``          - the staff dashboard polls this for
    everyone still waiting on verification.
  * ``PUT  /api/staff/verify/{id}``    - a staff member confirms (optionally
    editing) a record, which removes it from the pending queue.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool

from db import create_registration, delete_pending_registration, list_queue, verify_registration
from models.registration import (
    RegistrationRecord,
    SubmitRegistrationIn,
    SubmitRegistrationOut,
    VerifyRegistrationIn,
)
from services.registration_validation import invalid_core_fields, normalize_patient_data

router = APIRouter()

# A lightweight, deterministic triage heuristic for the prototype. A real
# deployment would have a nurse set this during intake; here we derive a
# reasonable starting point from the stated reason for visit so the Staff
# Dashboard has something meaningful to triage against.
_URGENT_KEYWORDS = (
    "chest pain",
    "can't breathe",
    "cannot breathe",
    "breathless",
    "severe bleeding",
    "unconscious",
    "seizure",
    "stroke",
    "heart attack",
    "accident",
    "emergency",
)
_MODERATE_KEYWORDS = (
    "fever",
    "pain",
    "injury",
    "infection",
    "vomiting",
    "fracture",
    "dizziness",
)
_FIELD_LABELS = {
    "full_name": "full name",
    "date_of_birth": "date of birth",
    "age": "age",
    "gender": "gender",
    "phone": "mobile number",
    "visit_reason": "reason for visit",
}


def _derive_triage_level(patient_data: dict[str, Any]) -> str:
    reason = str(patient_data.get("visit_reason") or "").lower()
    if any(keyword in reason for keyword in _URGENT_KEYWORDS):
        return "Urgent"
    if any(keyword in reason for keyword in _MODERATE_KEYWORDS):
        return "Moderate"
    return "Routine"


def _token_for_sequence(sequence: int) -> str:
    return f"A-{100 + sequence}"


def _to_public_record(record: dict[str, Any]) -> dict[str, Any]:
    """Strips the internal `sequence` field (used only for token numbering)."""
    return {"id": record["id"], "patient_data": record["patient_data"], "status": record["status"], "created_at": record["created_at"]}


def _incomplete_registration_error(invalid_fields: list[str]) -> HTTPException:
    return HTTPException(
        status_code=422,
        detail={
            "code": "incomplete_registration",
            "message": "Please provide valid answers for: "
            + ", ".join(_FIELD_LABELS[field_id] for field_id in invalid_fields)
            + ".",
            "invalid_fields": invalid_fields,
        },
    )


@router.post("/registration/submit", response_model=SubmitRegistrationOut, status_code=201)
async def submit_registration(payload: SubmitRegistrationIn) -> dict[str, Any]:
    """Saves the AI's extracted JSON with status PENDING_VERIFICATION."""
    invalid_fields = invalid_core_fields(payload.patient_data)
    if invalid_fields:
        raise _incomplete_registration_error(invalid_fields)

    patient_data = normalize_patient_data(payload.patient_data)
    patient_data.setdefault("triage_level", _derive_triage_level(patient_data))

    try:
        record = await run_in_threadpool(create_registration, patient_data)
    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail={"code": "storage_error", "message": "Could not save the registration."},
        ) from error

    return {
        "id": record["id"],
        "status": record["status"],
        "token": _token_for_sequence(record["sequence"]),
    }


@router.get("/staff/queue", response_model=list[RegistrationRecord])
async def get_staff_queue() -> list[dict[str, Any]]:
    """Every record still waiting on staff verification, oldest first."""
    records = await run_in_threadpool(list_queue)
    return [_to_public_record(record) for record in records]


@router.put("/staff/verify/{registration_id}", response_model=RegistrationRecord)
async def verify_registration_route(registration_id: str, payload: VerifyRegistrationIn) -> dict[str, Any]:
    """Applies a staff member's confirmed/edited data and marks it VERIFIED."""
    invalid_fields = invalid_core_fields(payload.patient_data)
    if invalid_fields:
        raise _incomplete_registration_error(invalid_fields)
    patient_data = normalize_patient_data(payload.patient_data)
    updated = await run_in_threadpool(verify_registration, registration_id, patient_data)
    if updated is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Registration not found in the queue."},
        )
    return _to_public_record(updated)


@router.delete("/staff/queue/{registration_id}", status_code=204)
async def delete_registration_route(registration_id: str) -> None:
    """Removes a pending registration from the staff queue."""
    deleted = await run_in_threadpool(delete_pending_registration, registration_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Pending registration not found in the queue."},
        )
