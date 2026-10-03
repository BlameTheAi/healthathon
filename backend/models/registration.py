from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


Language = Literal["en-IN", "hi-IN", "gu-IN"]


class ConversationMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["assistant", "patient"]
    text: str = Field(min_length=1, max_length=5000)


class RegistrationQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1, max_length=100)
    question: str | dict[str, str]
    required: bool
    enabled: bool = True


class ConversationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    language: Language
    conversation: list[ConversationMessage] = Field(min_length=1, max_length=100)
    questions: list[RegistrationQuestion] = Field(min_length=1, max_length=100)
    # Cumulative state the frontend holds from previous turns. The server keeps
    # no session, so this is how corrections and earlier answers persist.
    current_state: dict[str, str | bool | int | float | None] = Field(default_factory=dict)


class NextQuestion(BaseModel):
    id: str
    text: str


class ConversationResponse(BaseModel):
    spoken_reply: str
    detected_correction: bool
    corrected_fields: list[str]
    is_registration_complete: bool
    extracted_information: dict[str, Any]
    next_question: NextQuestion | None
    missing_required_fields: list[str]


class RegistrationStatus(str, Enum):
    """Where a registration sits in the Patient Kiosk -> Staff Dashboard queue."""

    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"


class SubmitRegistrationIn(BaseModel):
    """What the Patient Kiosk posts once the AI conversation finishes.

    ``patient_data`` is whatever the kiosk extracted (name, date of birth,
    visit reason, etc.) - it is stored as-is and only re-shaped by staff
    during verification.
    """

    model_config = ConfigDict(extra="forbid")

    patient_data: dict[str, Any]


class VerifyRegistrationIn(BaseModel):
    """What the Staff Dashboard sends after a staff member edits a record."""

    model_config = ConfigDict(extra="forbid")

    patient_data: dict[str, Any]


class RegistrationRecord(BaseModel):
    """A row in the registration queue, as returned to either device."""

    model_config = ConfigDict(extra="forbid")

    id: str
    patient_data: dict[str, Any]
    status: RegistrationStatus
    created_at: str


class SubmitRegistrationOut(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    status: RegistrationStatus
    token: str
