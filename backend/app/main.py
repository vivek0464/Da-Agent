import os
import json
import asyncio
import logging
import warnings

from dotenv import load_dotenv

load_dotenv()

from app.firebase_admin import initialize_firebase

initialize_firebase()

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from google import genai as google_genai
from google.genai import types
from google.genai.types import Type

from app.agent.agent import INSTRUCTION
from app.agent.tools import (
    search_patient_in_queue,
    get_patient_info,
    update_prescription,
    finalize_prescription,
)
from app.routers import clinics, patients, appointments, prescriptions, availability, register
from app.routers import auth as auth_router

warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

LIVE_MODEL = os.getenv("GEMINI_LIVE_MODEL", "gemini-2.5-flash-native-audio-preview-12-2025")

# genai client with v1beta — required for Live API with AI Studio keys
live_client = google_genai.Client(
    http_options={"api_version": "v1beta"},
    api_key=os.getenv("GOOGLE_API_KEY"),
)

# ── Tool function declarations (no dict types → no additionalProperties) ──────

S = Type.STRING
O = Type.OBJECT
A = Type.ARRAY

I = Type.INTEGER
def _s(**kw): return types.Schema(type=S, **kw)
def _i(**kw): return types.Schema(type=I, **kw)
def _b(): return types.Schema(type=Type.BOOLEAN)
def _o(props, req=None): return types.Schema(type=O, properties=props, required=req or [])
def _arr(): return types.Schema(type=A, items=types.Schema(type=S), nullable=True)

TOOL_DECLARATIONS = types.Tool(function_declarations=[
    types.FunctionDeclaration(
        name="search_patient_in_queue",
        description=(
            "Search today's queue for a patient by name and/or age. "
            "Leave both empty to get the current head of queue. "
            "Returns queue position, patient profile, and recent prescription summary."
        ),
        parameters=_o({
            "name": _s(nullable=True),
            "age": _i(nullable=True),
        }),
    ),
    types.FunctionDeclaration(
        name="get_patient_info",
        description=(
            "Get a patient's full profile and complete prescription history. "
            "Leave query empty to use the current head of today's queue."
        ),
        parameters=_o({"query": _s(nullable=True)}),
    ),
    types.FunctionDeclaration(
        name="update_prescription",
        description=(
            "Update the current draft prescription with the doctor's dictation. "
            "Batch all fields (complaints, diagnosis, medications, tests, follow_up) in one call. "
            "Leave patient_name empty to target the head of queue. "
            "medications_json: JSON array e.g. "
            '[{"name":"Paracetamol","dosage":"500mg","frequency":"TID","duration":"5 days"}]'
        ),
        parameters=_o({
            "patient_name": _s(nullable=True),
            "complaints": _arr(),
            "diagnosis": _arr(),
            "medications_json": _s(nullable=True),
            "tests": _arr(),
            "follow_up": _s(nullable=True),
            "notes": _s(nullable=True),
        }),
    ),
    types.FunctionDeclaration(
        name="finalize_prescription",
        description=(
            "Finalize a patient's draft prescription (locks it and sends to print). "
            "Leave patient_name empty to target the head of queue."
        ),
        parameters=_o({"patient_name": _s(nullable=True)}),
    ),
])


async def dispatch_tool(name: str, args: dict, clinic_id: str, doctor_id: str) -> str:
    """Dispatch a tool call to the appropriate function."""
    cid = clinic_id or ""
    did = doctor_id or ""
    logger.info(f"Tool call: {name} args={list(args.keys())}")
    try:
        if name == "search_patient_in_queue":
            return await search_patient_in_queue(
                cid, did,
                name=args.get("name") or "",
                age=int(args["age"]) if args.get("age") is not None else None,
            )
        elif name == "get_patient_info":
            return await get_patient_info(cid, did, args.get("query") or "")
        elif name == "update_prescription":
            return await update_prescription(
                cid, did,
                patient_name=args.get("patient_name") or "",
                complaints=args.get("complaints"),
                diagnosis=args.get("diagnosis"),
                medications_json=args.get("medications_json"),
                tests=args.get("tests"),
                follow_up=args.get("follow_up"),
                notes=args.get("notes"),
            )
        elif name == "finalize_prescription":
            return await finalize_prescription(cid, did, args.get("patient_name") or "")
        else:
            return f"Unknown tool: {name}"
    except Exception as exc:
        logger.error(f"Tool {name} error: {exc}", exc_info=True)
        return f"Error executing {name}: {exc}"


app = FastAPI(title="Doctor Assistant API", version="1.0.0")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(clinics.router)
app.include_router(patients.router)
app.include_router(appointments.router)
app.include_router(prescriptions.router)
app.include_router(availability.router)
app.include_router(register.router)
app.include_router(auth_router.router)


@app.get("/health")
async def health():
    return {"status": "ok", "agent_model": LIVE_MODEL}


@app.websocket("/ws/voice/{user_id}/{session_id}")
async def voice_websocket(
    websocket: WebSocket,
    user_id: str,
    session_id: str,
    clinic_id: str = Query(None),
    doctor_id: str = Query(None),
):
    await websocket.accept()
    logger.info(f"Voice WS connected: user={user_id} session={session_id} clinic={clinic_id}")

    config = types.LiveConnectConfig(
        response_modalities=["AUDIO"],
        system_instruction=INSTRUCTION,
        tools=[TOOL_DECLARATIONS],
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Zephyr")
            )
        ),
        context_window_compression=types.ContextWindowCompressionConfig(
            trigger_tokens=104857,
            sliding_window=types.SlidingWindow(target_tokens=52428),
        ),
    )

    try:
        async with live_client.aio.live.connect(model=LIVE_MODEL, config=config) as session:

            async def upstream() -> None:
                try:
                    while True:
                        msg = await websocket.receive()
                        if msg.get("bytes"):
                            # Raw PCM audio — only sent by frontend when Silero VAD is active
                            await session.send(
                                input=types.LiveClientRealtimeInput(
                                    media_chunks=[types.Blob(
                                        mime_type="audio/pcm;rate=16000",
                                        data=msg["bytes"],
                                    )]
                                )
                            )
                        elif msg.get("text"):
                            try:
                                data = json.loads(msg["text"])
                                if data.get("type") == "text":
                                    await session.send(input=data["text"], end_of_turn=True)
                            except json.JSONDecodeError:
                                pass
                except (WebSocketDisconnect, Exception):
                    pass

            async def downstream() -> None:
                import base64
                while True:
                    turn = session.receive()
                    async for response in turn:
                        # Handle tool calls
                        if response.tool_call:
                            tool_responses = []
                            for fc in response.tool_call.function_calls:
                                result = await dispatch_tool(
                                    fc.name, dict(fc.args or {}), clinic_id or "", doctor_id or ""
                                )
                                tool_responses.append(
                                    types.FunctionResponse(
                                        name=fc.name,
                                        id=fc.id,
                                        response={"output": result},
                                    )
                                )
                            await session.send(
                                input=types.LiveClientToolResponse(function_responses=tool_responses)
                            )
                            continue

                        # Forward audio + transcription to frontend as JSON
                        payload: dict = {}

                        if response.data:
                            payload.setdefault("serverContent", {}).setdefault(
                                "modelTurn", {}
                            ).setdefault("parts", []).append({
                                "inlineData": {
                                    "mimeType": "audio/pcm",
                                    "data": base64.b64encode(response.data).decode(),
                                }
                            })

                        if response.text:
                            payload.setdefault("serverContent", {}).setdefault(
                                "outputTranscription", {}
                            )["text"] = response.text

                        if hasattr(response, "server_content") and response.server_content:
                            sc = response.server_content
                            if hasattr(sc, "input_transcription") and sc.input_transcription:
                                payload.setdefault("serverContent", {}).setdefault(
                                    "inputTranscription", {}
                                )["text"] = sc.input_transcription.text or ""

                        if payload:
                            try:
                                await websocket.send_text(json.dumps(payload))
                            except Exception:
                                return

            upstream_task = asyncio.create_task(upstream())
            downstream_task = asyncio.create_task(downstream())

            done, pending = await asyncio.wait(
                [upstream_task, downstream_task],
                return_when=asyncio.FIRST_COMPLETED,
            )
            for t in pending:
                t.cancel()

    except WebSocketDisconnect:
        logger.info(f"Voice WS disconnected: {user_id}")
    except Exception as exc:
        logger.error(f"Voice WS error: {exc}", exc_info=True)
    finally:
        logger.info(f"Voice WS closed: user={user_id} session={session_id}")
