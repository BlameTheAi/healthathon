from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

from db import init_db
from models.registration import ConversationRequest, ConversationResponse
from registration_api import router as registration_router
from services.gemini_service import (
    GeminiRateLimitError,
    GeminiUnavailableError,
    InvalidGeminiResponseError,
)
from services.registration_service import InvalidStructuredResponseError, process_conversation


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    await run_in_threadpool(init_db)
    yield


app = FastAPI(title="CareFlow Registration API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["DELETE", "GET", "POST", "PUT"],
    allow_headers=["Content-Type"],
)

# The Patient Kiosk (submit) and Staff Dashboard (queue, verify) routes.
app.include_router(registration_router, prefix="/api")


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/registration/conversation", response_model=ConversationResponse)
async def continue_registration(request: ConversationRequest) -> ConversationResponse:
    try:
        return await run_in_threadpool(
            process_conversation,
            language=request.language,
            conversation=[message.model_dump() for message in request.conversation],
            questions=[question.model_dump() for question in request.questions],
            current_state=request.current_state,
        )
    except GeminiRateLimitError as error:
        raise HTTPException(
            status_code=429,
            detail={"code": "rate_limit", "message": "The service is temporarily busy. Please try again."},
        ) from error
    except (InvalidGeminiResponseError, InvalidStructuredResponseError) as error:
        raise HTTPException(
            status_code=502,
            detail={"code": "invalid_response", "message": "The response could not be validated."},
        ) from error
    except GeminiUnavailableError as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "unavailable", "message": "Registration assistance is temporarily unavailable."},
        ) from error
