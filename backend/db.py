"""Persistence for the asynchronous patient-registration queue.

The Patient Kiosk and the Staff Dashboard are modeled as two separate
devices that only ever talk to each other through this store:

  * The kiosk writes a new row with status ``PENDING_VERIFICATION`` once the
    AI conversation finishes, then moves on (no screen transition).
  * The staff dashboard polls for rows still ``PENDING_VERIFICATION`` and,
    once a staff member confirms the data, flips the row to ``VERIFIED``.

SQLite (via Python's built-in sqlite3 module) is used so the "database" is
a single file created next to this module the first time the backend
starts - no external services required for the prototype, but the data
still survives backend restarts during the demo.
"""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from models.registration import RegistrationStatus

DB_PATH = Path(__file__).resolve().parent / "careflow.db"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS registrations (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                id TEXT UNIQUE NOT NULL,
                patient_data TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


def _row_to_record(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "sequence": row["sequence"],
        "patient_data": json.loads(row["patient_data"]),
        "status": row["status"],
        "created_at": row["created_at"],
    }


def create_registration(patient_data: dict[str, Any]) -> dict[str, Any]:
    """Saves the AI-extracted JSON from the kiosk as a new pending record."""
    registration_id = str(uuid.uuid4())
    created_at = datetime.now(timezone.utc).isoformat()

    with get_connection() as connection:
        cursor = connection.execute(
            """
            INSERT INTO registrations (id, patient_data, status, created_at)
            VALUES (:id, :patient_data, :status, :created_at)
            """,
            {
                "id": registration_id,
                "patient_data": json.dumps(patient_data, ensure_ascii=False),
                "status": RegistrationStatus.PENDING_VERIFICATION.value,
                "created_at": created_at,
            },
        )
        connection.commit()
        sequence = cursor.lastrowid

    return {
        "id": registration_id,
        "sequence": sequence,
        "patient_data": patient_data,
        "status": RegistrationStatus.PENDING_VERIFICATION.value,
        "created_at": created_at,
    }


def list_queue() -> list[dict[str, Any]]:
    """All registrations still waiting on staff verification, oldest first."""
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT sequence, id, patient_data, status, created_at
            FROM registrations
            WHERE status = ?
            ORDER BY sequence ASC
            """,
            (RegistrationStatus.PENDING_VERIFICATION.value,),
        ).fetchall()
        return [_row_to_record(row) for row in rows]


def get_registration(registration_id: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT sequence, id, patient_data, status, created_at FROM registrations WHERE id = ?",
            (registration_id,),
        ).fetchone()
        return _row_to_record(row) if row is not None else None


def verify_registration(registration_id: str, patient_data: dict[str, Any]) -> dict[str, Any] | None:
    """Applies the staff member's edits and marks the record VERIFIED.

    Returns the updated record, or ``None`` if no such registration exists
    (for example, it was already verified by someone else).
    """
    with get_connection() as connection:
        cursor = connection.execute(
            """
            UPDATE registrations
            SET patient_data = :patient_data, status = :status
            WHERE id = :id
            """,
            {
                "id": registration_id,
                "patient_data": json.dumps(patient_data, ensure_ascii=False),
                "status": RegistrationStatus.VERIFIED.value,
            },
        )
        connection.commit()
        if cursor.rowcount == 0:
            return None

    return get_registration(registration_id)


def delete_pending_registration(registration_id: str) -> bool:
    """Delete a registration only while it is waiting for staff verification."""
    with get_connection() as connection:
        cursor = connection.execute(
            "DELETE FROM registrations WHERE id = ? AND status = ?",
            (registration_id, RegistrationStatus.PENDING_VERIFICATION.value),
        )
        connection.commit()
        return cursor.rowcount > 0
