from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import shutil
import subprocess
import time
import uuid
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from typing import Any
from urllib.parse import quote

import httpx
import uvicorn
from fastapi import FastAPI, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, StreamingResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from lobster_bridge import (
    LobsterAgentRequest,
    LobsterLlmConfig,
    count_enabled_skills,
    lobster_src_root,
    run_lobster_agent,
)
from storage import get_data_dir, read_json, write_json


APP_NAME = "agentcore-lobster-sidecar"
HEARTBEAT_TIMEOUT_SECONDS = max(
    5,
    int(os.getenv("AGENTCORE_HEARTBEAT_TIMEOUT_SECONDS", "10")),
)
HEARTBEAT_PATH = (
    os.getenv("AGENTCORE_HEARTBEAT_PATH", "/_agentcore/heartbeat").strip()
    or "/_agentcore/heartbeat"
)
DEFAULT_RUNTIME_PROFILE = os.getenv("AGENTCORE_RUNTIME_PROFILE", "desktop_light").strip()
DEFAULT_SIDECAR_API_URL = os.getenv("AGENTCORE_API_BASE_URL", "http://127.0.0.1:8080").strip()
CONNECTOR_BASE_URL = os.getenv("AGENTCORE_PUBLISH_CONNECTOR_URL", "http://127.0.0.1:8787").strip()

SYSTEM_PROMPT_BY_STYLE = {
    "xiaohongshu": "你是内容写作助手。请生成适合小红书发布的内容：大量使用 Emoji，排版要有空行，标题和开头要抓人；输出包含：标题（1-3 个备选）、正文、标签（# 话题），整体可直接发布。",
    "wechat": "你是写作助手。请生成适合公众号发布的文章：结构严谨、逻辑清晰、适合深度阅读；输出包含：标题、摘要、正文（分级小标题）、结论与行动建议。",
    "shortvideo": "你是脚本生成助手。请输出节奏快、口语化的短视频脚本，包含：开场 3 秒钩子、镜头/画面提示、口播文案、字幕要点、结尾关注引导。",
}
REMOTE_OFFICE_SYSTEM_PROMPT = (
    "You are AgentCore OS remote office bridge. "
    "The user is sending commands from a mobile IM client while away from the desktop. "
    "Return concise, execution-oriented results that fit an IM chat reply. "
    "If the request implies a larger deliverable, give the result summary first, then the next actionable step."
)

last_heartbeat_at = time.time()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    get_data_dir()
    uploads_root()
    outputs_root()
    task = asyncio.create_task(heartbeat_monitor())
    print(f"[{APP_NAME}] startup complete", flush=True)
    try:
        yield
    finally:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


app = FastAPI(title=APP_NAME, lifespan=lifespan)


class RuntimeBridgeConfig(BaseModel):
    profile: str = "desktop_light"
    orchestration: str = "none"
    composeProjectName: str = "agentcore-runtime"
    localAppUrl: str = "http://127.0.0.1:3000"
    localRuntimeUrl: str = "http://127.0.0.1:18789"
    sidecarApiUrl: str = DEFAULT_SIDECAR_API_URL
    difyBaseUrl: str = "http://127.0.0.1:5001"
    autoBootLocalStack: bool = False


class RuntimeSidecarActionPayload(BaseModel):
    action: str = Field(pattern="^(sync|boot|stop)$")
    config: RuntimeBridgeConfig | None = None


class PublishConfigPayload(BaseModel):
    matrixAccounts: dict[str, dict[str, str]]


class PublishJobCreatePayload(BaseModel):
    draftId: str | None = None
    draftTitle: str
    draftBody: str | None = None
    platforms: list[str]
    mode: str | None = "dry-run"
    status: str | None = "queued"
    maxAttempts: int | None = 1


class PublishJobPatchPayload(BaseModel):
    draftId: str | None = None
    draftTitle: str | None = None
    draftBody: str | None = None
    platforms: list[str] | None = None
    mode: str | None = None
    status: str | None = None
    attempts: int | None = None
    maxAttempts: int | None = None
    nextAttemptAt: int | None = None
    resultText: str | None = None
    results: list[dict[str, Any]] | None = None
    updatedAt: int | None = None


class LlmTestPayload(BaseModel):
    apiKey: str
    baseUrl: str
    model: str


class OpenClawTestPayload(BaseModel):
    baseUrl: str
    apiToken: str | None = ""


class OpenClawLlmPayload(BaseModel):
    provider: str | None = "openai"
    apiKey: str | None = ""
    baseUrl: str | None = ""
    model: str | None = ""


class OpenClawAgentPayload(BaseModel):
    message: str
    sessionId: str
    timeoutSeconds: int | None = 30
    systemPrompt: str | None = ""
    useLobsterSkills: bool | None = None
    useSkills: bool | None = True
    workspaceContext: dict[str, Any] | None = None
    llm: OpenClawLlmPayload | None = None


class ChatMessagePayload(BaseModel):
    role: str
    content: str


class LlmChatPayload(BaseModel):
    apiKey: str
    baseUrl: str
    model: str
    messages: list[ChatMessagePayload]
    stream: bool = True


class OpenClawCopyPayload(BaseModel):
    style: str | None = "xiaohongshu"
    topic: str | None = ""
    llm: OpenClawLlmPayload | None = None


class VaultFilePayload(BaseModel):
    id: str | None = None
    folderId: str | None = None
    name: str
    size: int = 0
    addedAt: int | None = None


class VaultQueryPayload(BaseModel):
    query: str | None = ""
    folderName: str | None = "知识库"
    files: list[VaultFilePayload] | None = None
    llm: OpenClawLlmPayload | None = None


class ExecutePayload(BaseModel):
    prompt: str | None = ""
    fileUrl: str | None = ""
    engineUrl: str | None = ""
    token: str | None = ""


class ImBridgeProviderConfigPayload(BaseModel):
    replyMode: str = Field(default="webhook", pattern="^(webhook|official_api)$")
    replyWebhookUrl: str = ""
    verificationToken: str = ""
    signingSecret: str = ""
    officialApiBaseUrl: str = ""
    officialAppId: str = ""
    officialAppSecret: str = ""
    officialTargetId: str = ""
    officialTargetIdType: str = ""
    officialRobotCode: str = ""
    officialConversationId: str = ""


class ImBridgeConfigPayload(BaseModel):
    enabled: bool = False
    publicBaseUrl: str = ""
    accessToken: str = ""
    defaultProvider: str = Field(default="generic", pattern="^(generic|feishu|dingtalk)$")
    autoReply: bool = True
    commandPrefix: str = ""
    providers: dict[str, ImBridgeProviderConfigPayload]


class ImBridgeTestPayload(BaseModel):
    provider: str | None = None


class ImBridgeEventQuery(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)


def parse_allowed_origins() -> list[str]:
    raw = os.getenv("LOBSTER_CORS_ALLOW_ORIGINS", "").strip()
    if not raw:
        return [
            "http://localhost:3000",
            "tauri://localhost",
            "http://tauri.localhost",
            "https://tauri.localhost",
        ]
    return [item.strip() for item in raw.split(",") if item.strip()]


def now_ms() -> int:
    return int(time.time() * 1000)


def normalize_base_url(input_value: str) -> str:
    trimmed = input_value.strip()
    if not trimmed:
        return ""
    no_slash = trimmed.rstrip("/")
    normalized_ws = re.sub(r"^wss://", "https://", no_slash, flags=re.IGNORECASE)
    normalized_ws = re.sub(r"^ws://", "http://", normalized_ws, flags=re.IGNORECASE)
    if re.match(r"^[a-zA-Z][a-zA-Z\d+\-.]*://", normalized_ws):
        return normalized_ws
    return f"http://{normalized_ws}"


def chat_completions_url(base_url: str) -> str:
    normalized = normalize_base_url(base_url)
    if normalized.endswith("/v1"):
        return f"{normalized}/chat/completions"
    if normalized.endswith("/chat/completions"):
        return normalized
    return f"{normalized}/v1/chat/completions"


def run(command: list[str]) -> dict[str, Any]:
    executable = resolve_command(command[0]) if command else None
    if not executable:
        return {"ok": False, "stdout": "", "stderr": f"Command not found: {command[0] if command else ''}"}
    try:
        result = subprocess.run(
            [executable, *command[1:]],
            capture_output=True,
            text=True,
            check=False,
        )
        return {
            "ok": result.returncode == 0,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except Exception as exc:
        return {"ok": False, "stdout": "", "stderr": str(exc)}


def resolve_command(command: str) -> str | None:
    candidates = [
        shutil.which(command),
        f"/opt/homebrew/bin/{command}",
        f"/usr/local/bin/{command}",
        f"/Applications/Docker.app/Contents/Resources/bin/{command}",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def runtime_state_path() -> str:
    return "runtime-sidecar-state.json"


def publish_config_path() -> str:
    return "publish-config.json"


def publish_jobs_path() -> str:
    return "publish-jobs.json"


def llm_config_path() -> str:
    return "last-llm-config.json"


def im_bridge_config_path() -> str:
    return "im-bridge-config.json"


def im_bridge_events_path() -> str:
    return "im-bridge-events.json"


def desktop_settings_path() -> str:
    return "app-settings.json"


def runtime_root() -> Path:
    root = get_data_dir() / "runtime"
    root.mkdir(parents=True, exist_ok=True)
    return root


def runtime_stack_root() -> Path:
    root = get_data_dir() / "desktop-runtime"
    root.mkdir(parents=True, exist_ok=True)
    return root


def runtime_compose_file() -> Path:
    explicit = os.getenv("AGENTCORE_RUNTIME_COMPOSE_FILE", "").strip()
    if explicit:
        path = Path(explicit).expanduser()
        if path.exists():
            return path

    resource_dir = os.getenv("AGENTCORE_RESOURCE_DIR", "").strip()
    candidates: list[Path] = []
    if resource_dir:
        resource_root = Path(resource_dir).expanduser()
        candidates.extend(
            [
                resource_root / "_up_" / "deploy" / "desktop-runtime" / "docker-compose.agentcore-runtime.example.yml",
                resource_root / "_up_" / "desktop-runtime" / "docker-compose.agentcore-runtime.example.yml",
                resource_root / "deploy" / "desktop-runtime" / "docker-compose.agentcore-runtime.example.yml",
                resource_root / "desktop-runtime" / "docker-compose.agentcore-runtime.example.yml",
            ]
        )

    cwd = Path.cwd()
    candidates.extend(
        [
            cwd / "deploy" / "desktop-runtime" / "docker-compose.agentcore-runtime.example.yml",
            cwd.parent / "deploy" / "desktop-runtime" / "docker-compose.agentcore-runtime.example.yml",
        ]
    )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    return candidates[0]


def uploads_root() -> Path:
    root = runtime_root() / "uploads"
    root.mkdir(parents=True, exist_ok=True)
    return root


def outputs_root() -> Path:
    root = runtime_root() / "outputs"
    root.mkdir(parents=True, exist_ok=True)
    return root


def default_runtime_config() -> dict[str, Any]:
    return RuntimeBridgeConfig(profile=DEFAULT_RUNTIME_PROFILE).model_dump()


def sanitize_runtime_config(config: dict[str, Any] | None) -> dict[str, Any]:
    fallback = default_runtime_config()
    source = config or {}

    profile = str(source.get("profile", fallback["profile"]) or fallback["profile"]).strip()
    if profile not in {"desktop_light", "desktop_dify"}:
        profile = str(fallback["profile"])

    orchestration = str(
        source.get("orchestration", fallback["orchestration"]) or fallback["orchestration"]
    ).strip()
    if orchestration not in {"none", "docker_compose"}:
        orchestration = str(fallback["orchestration"])

    def pick_string(key: str) -> str:
        value = source.get(key, fallback[key])
        if isinstance(value, str) and value.strip():
            return value.strip()
        return str(fallback[key])

    return {
        "profile": profile,
        "orchestration": orchestration,
        "composeProjectName": pick_string("composeProjectName"),
        "localAppUrl": pick_string("localAppUrl"),
        "localRuntimeUrl": pick_string("localRuntimeUrl"),
        "sidecarApiUrl": pick_string("sidecarApiUrl"),
        "difyBaseUrl": pick_string("difyBaseUrl"),
        "autoBootLocalStack": bool(source.get("autoBootLocalStack", fallback["autoBootLocalStack"])),
    }


def normalize_runtime_last_action(value: dict[str, Any] | None) -> dict[str, Any]:
    source = value or {}
    action = source.get("type")
    if action not in {"sync", "boot", "stop"}:
        action = None
    at = source.get("at")
    ok = source.get("ok")
    message = source.get("message")
    return {
        "type": action,
        "at": str(at) if isinstance(at, str) and at.strip() else None,
        "ok": ok if isinstance(ok, bool) else None,
        "message": str(message) if isinstance(message, str) and message.strip() else None,
    }


def runtime_state_file() -> Path:
    return get_data_dir() / runtime_state_path()


def load_runtime_state() -> dict[str, Any]:
    raw = read_json(
        runtime_state_path(),
        {
            "config": default_runtime_config(),
            "lastAction": {
                "type": None,
                "at": None,
                "ok": None,
                "message": None,
            },
        },
    )
    if not isinstance(raw, dict):
        raw = {}
    return {
        "config": sanitize_runtime_config(raw.get("config") if isinstance(raw.get("config"), dict) else None),
        "lastAction": normalize_runtime_last_action(
            raw.get("lastAction") if isinstance(raw.get("lastAction"), dict) else None
        ),
    }


def save_runtime_state(state: dict[str, Any]) -> None:
    write_json(runtime_state_path(), state)


def get_runtime_doctor_report() -> dict[str, Any]:
    docker = run(["docker", "--version"])
    docker_compose = (
        run(["docker", "compose", "version"]) if docker["ok"] else {"ok": False, "stdout": "", "stderr": ""}
    )
    node = run(["node", "--version"])
    ffmpeg = run(["ffmpeg", "-version"])
    compose_template = runtime_compose_file()
    data_dir = get_data_dir()
    local_store_probe = data_dir / ".doctor-write-test"
    try:
        data_dir.mkdir(parents=True, exist_ok=True)
        local_store_probe.write_text("ok", encoding="utf-8")
        local_store_probe.unlink(missing_ok=True)
        local_store = {"ok": True, "version": str(data_dir), "error": None}
    except Exception as exc:
        local_store = {"ok": False, "version": None, "error": str(exc)}

    runtime_template = {
        "ok": compose_template.exists(),
        "version": str(compose_template) if compose_template.exists() else None,
        "error": None if compose_template.exists() else f"Missing runtime template: {compose_template}",
    }
    desktop_light_ready = bool(local_store["ok"])
    desktop_dify_ready = bool(local_store["ok"] and runtime_template["ok"] and docker["ok"] and docker_compose["ok"])
    creative_studio_ready = bool(ffmpeg["ok"])

    return {
        "runtimeMode": "api_only",
        "checkedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "recommendedProfile": "desktop_dify" if desktop_dify_ready else "desktop_light",
        "checks": {
            "node": {
                "ok": node["ok"],
                "version": node["stdout"] or None,
                "error": node["stderr"] or None,
            },
            "ffmpeg": {
                "ok": ffmpeg["ok"],
                "version": (ffmpeg["stdout"].splitlines()[0].strip() if ffmpeg["stdout"] else None),
                "error": ffmpeg["stderr"] or ffmpeg.get("error") or None,
            },
            "docker": {
                "ok": docker["ok"],
                "version": docker["stdout"] or None,
                "error": docker["stderr"] or None,
            },
            "dockerCompose": {
                "ok": docker_compose["ok"],
                "version": docker_compose["stdout"] or None,
                "error": docker_compose["stderr"] or None,
            },
            "runtimeTemplate": runtime_template,
            "localStore": local_store,
        },
        "readiness": {
            "desktopLightReady": desktop_light_ready,
            "desktopDifyReady": desktop_dify_ready,
            "creativeStudioReady": creative_studio_ready,
        },
        "nextAction": (
            "Fix local storage permissions first. The desktop app needs a writable local data directory before first-run testing."
            if not desktop_light_ready
            else (
                "This machine is ready for full desktop testing, including Desktop + Dify Runtime and Creative Studio local video processing."
                if desktop_dify_ready and creative_studio_ready
                else (
                    "This machine can run the full desktop stack. Install ffmpeg only if you need Creative Studio local video processing."
                    if desktop_dify_ready
                    else (
                        "A fresh machine can already install and test in Desktop Light mode after you fill in an API key. Install Docker Desktop only if you need local Dify orchestration."
                        if creative_studio_ready
                        else "A fresh machine can install and test most workflows in Desktop Light mode after you fill in an API key. Install ffmpeg for Creative Studio, and Docker Desktop only if you need local Dify orchestration."
                    )
                )
            )
        ),
    }


def get_lobster_bridge_status() -> dict[str, Any]:
    enabled_skills = count_enabled_skills()
    source_root = lobster_src_root()
    return {
        "mode": "lobster_api_bridge",
        "sourceRoot": str(source_root),
        "sourceAvailable": source_root.exists(),
        "enabledSkills": enabled_skills,
        "capabilities": {
            "liveWebSearchProviders": ["openai", "anthropic"],
            "apiOnly": True,
            "localLlm": False,
        },
    }


def get_runtime_sidecar_status() -> dict[str, Any]:
    state = load_runtime_state()
    config = sanitize_runtime_config(state["config"])
    doctor = get_runtime_doctor_report()
    compose_file_path, env_file_path = ensure_runtime_stack_files(config)
    compose_template_exists = compose_file_path.exists()
    can_manage = (
        config.get("profile") == "desktop_dify"
        and config.get("orchestration") == "docker_compose"
    )
    bootable = (
        can_manage
        and compose_template_exists
        and doctor["checks"]["docker"]["ok"]
        and doctor["checks"]["dockerCompose"]["ok"]
    )
    services = load_runtime_compose_services(config, compose_file_path, env_file_path) if bootable else []
    running = any(str(service.get("state", "")) == "running" for service in services)
    ready = bool(config.get("profile") == "desktop_light") or (
        len(services) > 0
        and all(
            str(service.get("state", "")) == "running"
            and (
                service.get("health") in (None, "", "healthy")
            )
            for service in services
        )
    )

    next_action = doctor["nextAction"]
    if can_manage and not compose_template_exists:
        next_action = "Runtime compose template is missing from the desktop bundle."
    elif can_manage and not doctor["checks"]["docker"]["ok"]:
        next_action = doctor["nextAction"]
    elif can_manage and not doctor["checks"]["dockerCompose"]["ok"]:
        next_action = doctor["nextAction"]
    elif bootable:
        next_action = (
            "Sidecar stack is available. You can keep working or stop it from the runtime panel."
            if running
            else "Local sidecar is ready to boot. Use the runtime panel to start the compose stack."
        )

    return {
        "synced": runtime_state_file().exists(),
        "canManage": can_manage,
        "bootable": bootable,
        "running": running,
        "ready": ready,
        "config": config,
        "composeFilePath": str(compose_file_path),
        "envFilePath": str(env_file_path),
        "services": services,
        "doctor": doctor,
        "nextAction": next_action,
        "lastAction": state["lastAction"],
    }


def build_runtime_env_file_content(config: dict[str, Any]) -> str:
    compose_project_name = str(config.get("composeProjectName", "agentcore-runtime") or "agentcore-runtime").strip()
    dify_base_url = str(config.get("difyBaseUrl", "http://127.0.0.1:5001") or "http://127.0.0.1:5001").strip()
    local_app_url = str(config.get("localAppUrl", "http://127.0.0.1:3000") or "http://127.0.0.1:3000").strip()
    local_runtime_url = str(config.get("localRuntimeUrl", "http://127.0.0.1:18789") or "http://127.0.0.1:18789").strip()
    sidecar_api_url = str(config.get("sidecarApiUrl", DEFAULT_SIDECAR_API_URL) or DEFAULT_SIDECAR_API_URL).strip()
    return "\n".join(
        [
            f"COMPOSE_PROJECT_NAME={compose_project_name}",
            f"AGENTCORE_RUNTIME_APP_URL={local_app_url}",
            f"AGENTCORE_RUNTIME_URL={local_runtime_url}",
            f"AGENTCORE_SIDECAR_API_URL={sidecar_api_url}",
            f"AGENTCORE_DIFY_BASE_URL={dify_base_url}",
            "AGENTCORE_POSTGRES_IMAGE=postgres:15-alpine",
            "AGENTCORE_REDIS_IMAGE=redis:7-alpine",
            "AGENTCORE_QDRANT_IMAGE=qdrant/qdrant:v1.13.2",
            "AGENTCORE_DIFY_API_IMAGE=langgenius/dify-api:0.13.1",
            "AGENTCORE_DIFY_WORKER_IMAGE=langgenius/dify-api:0.13.1",
            "POSTGRES_DB=dify",
            "POSTGRES_USER=postgres",
            "POSTGRES_PASSWORD=agentcore",
            "POSTGRES_PORT=5433",
            "REDIS_PORT=6380",
            "QDRANT_PORT=6333",
            f"DIFY_API_PORT={parse_port_from_url(dify_base_url, 5001)}",
            "DIFY_WORKER_PORT=5002",
        ]
    )


def parse_port_from_url(value: str, fallback_port: int) -> str:
    normalized = normalize_base_url(value)
    if not normalized:
        return str(fallback_port)
    try:
        from urllib.parse import urlparse

        parsed = urlparse(normalized)
        return str(parsed.port or fallback_port)
    except Exception:
        return str(fallback_port)


def ensure_runtime_stack_files(config: dict[str, Any]) -> tuple[Path, Path]:
    compose_file_path = runtime_compose_file()
    env_file_path = (
        runtime_stack_root()
        / f"{str(config.get('composeProjectName', 'agentcore-runtime') or 'agentcore-runtime').strip()}.env"
    )
    env_file_path.write_text(build_runtime_env_file_content(config), encoding="utf-8")
    return compose_file_path, env_file_path


def normalize_runtime_service_status(stdout: str) -> list[dict[str, Any]]:
    if not stdout.strip():
        return []

    lines = [line.strip() for line in stdout.splitlines() if line.strip()]
    items: list[Any] = []
    if len(lines) == 1:
        try:
            parsed = json.loads(lines[0])
            if isinstance(parsed, list):
                items = parsed
            elif isinstance(parsed, dict):
                items = [parsed]
        except Exception:
            items = []
    if not items:
        for line in lines:
            try:
                parsed = json.loads(line)
            except Exception:
                continue
            if isinstance(parsed, dict):
                items.append(parsed)

    normalized: list[dict[str, Any]] = []
    for item in items:
        publishers = item.get("Publishers") if isinstance(item, dict) else []
        published_ports: list[str] = []
        if isinstance(publishers, list):
            for publisher in publishers:
                if not isinstance(publisher, dict):
                    continue
                target = str(publisher.get("TargetPort", "") or "").strip()
                published = str(publisher.get("PublishedPort", "") or "").strip()
                if target and published:
                    published_ports.append(f"{published}->{target}")
                elif target or published:
                    published_ports.append(published or target)
        normalized.append(
            {
                "service": str(item.get("Service", item.get("Name", "unknown")) if isinstance(item, dict) else "unknown"),
                "state": str(item.get("State", "unknown") if isinstance(item, dict) else "unknown"),
                "health": (
                    str(item.get("Health", "")).strip()
                    if isinstance(item, dict) and str(item.get("Health", "")).strip()
                    else None
                ),
                "statusText": (
                    str(item.get("Status", "")).strip()
                    if isinstance(item, dict) and str(item.get("Status", "")).strip()
                    else str(item.get("State", "unknown") if isinstance(item, dict) else "unknown")
                ),
                "publishedPorts": published_ports,
            }
        )
    return normalized


def load_runtime_compose_services(config: dict[str, Any], compose_file_path: Path, env_file_path: Path) -> list[dict[str, Any]]:
    result = run(
        [
            "docker",
            "compose",
            "--project-name",
            str(config.get("composeProjectName", "agentcore-runtime") or "agentcore-runtime").strip(),
            "--file",
            str(compose_file_path),
            "--env-file",
            str(env_file_path),
            "ps",
            "--format",
            "json",
        ]
    )
    return normalize_runtime_service_status(result.get("stdout", "")) if result.get("ok") else []


def load_desktop_settings() -> dict[str, Any] | None:
    data = read_json(desktop_settings_path(), None)
    return data if isinstance(data, dict) else None


def save_desktop_settings(value: dict[str, Any]) -> dict[str, Any]:
    write_json(desktop_settings_path(), value)
    return value


def execute_runtime_action(action: str, config: dict[str, Any]) -> tuple[bool, str]:
    if action == "sync":
        ensure_runtime_stack_files(config)
        return True, "Runtime config synced to the Python sidecar bridge."

    doctor = get_runtime_doctor_report()
    manageable = (
        config.get("profile") == "desktop_dify"
        and config.get("orchestration") == "docker_compose"
    )
    if not manageable:
        return False, "Switch to Desktop + Dify Runtime before managing the local sidecar stack."

    compose_file_path, env_file_path = ensure_runtime_stack_files(config)
    if not compose_file_path.exists():
        return False, f"Missing runtime compose template: {compose_file_path}"

    if not doctor["checks"]["docker"]["ok"] or not doctor["checks"]["dockerCompose"]["ok"]:
        return False, str(doctor["nextAction"])

    compose_args = ["up", "-d"] if action == "boot" else ["stop"] if action == "stop" else []
    result = run(
        [
            "docker",
            "compose",
            "--project-name",
            str(config.get("composeProjectName", "agentcore-runtime") or "agentcore-runtime").strip(),
            "--file",
            str(compose_file_path),
            "--env-file",
            str(env_file_path),
            *compose_args,
        ]
    )
    ok = bool(result.get("ok"))
    message = (
        (result.get("stdout") if ok else result.get("stderr") or result.get("stdout") or "").strip()
        or ("Local sidecar boot started." if action == "boot" else "Local sidecar stopped.")
    )
    return ok, message


def load_publish_config() -> dict[str, Any]:
    return read_json(
        publish_config_path(),
        {
            "xiaohongshu": {"token": "", "webhookUrl": ""},
            "douyin": {"token": "", "webhookUrl": ""},
            "instagram": {"token": "", "webhookUrl": ""},
            "tiktok": {"token": "", "webhookUrl": ""},
            "storefront": {"token": "", "webhookUrl": ""},
        },
    )


def save_publish_config(config: dict[str, Any]) -> None:
    write_json(publish_config_path(), config)


def load_publish_jobs() -> list[dict[str, Any]]:
    return read_json(publish_jobs_path(), [])


def save_publish_jobs(jobs: list[dict[str, Any]]) -> None:
    write_json(publish_jobs_path(), jobs)


def default_im_bridge_config() -> dict[str, Any]:
    return {
        "enabled": False,
        "publicBaseUrl": "",
        "accessToken": "",
        "defaultProvider": "generic",
        "autoReply": True,
        "commandPrefix": "",
        "providers": {
            "generic": {
                "replyMode": "webhook",
                "replyWebhookUrl": "",
                "verificationToken": "",
                "signingSecret": "",
                "officialApiBaseUrl": "",
                "officialAppId": "",
                "officialAppSecret": "",
                "officialTargetId": "",
                "officialTargetIdType": "",
                "officialRobotCode": "",
                "officialConversationId": "",
            },
            "feishu": {
                "replyMode": "webhook",
                "replyWebhookUrl": "",
                "verificationToken": "",
                "signingSecret": "",
                "officialApiBaseUrl": "https://open.feishu.cn",
                "officialAppId": "",
                "officialAppSecret": "",
                "officialTargetId": "",
                "officialTargetIdType": "chat_id",
                "officialRobotCode": "",
                "officialConversationId": "",
            },
            "dingtalk": {
                "replyMode": "webhook",
                "replyWebhookUrl": "",
                "verificationToken": "",
                "signingSecret": "",
                "officialApiBaseUrl": "https://api.dingtalk.com",
                "officialAppId": "",
                "officialAppSecret": "",
                "officialTargetId": "",
                "officialTargetIdType": "",
                "officialRobotCode": "",
                "officialConversationId": "",
            },
        },
    }


def normalize_im_bridge_config(config: dict[str, Any] | None) -> dict[str, Any]:
    source = config or {}
    default = default_im_bridge_config()
    providers = source.get("providers") if isinstance(source.get("providers"), dict) else {}

    def provider_config(provider_id: str) -> dict[str, str]:
        item = providers.get(provider_id) if isinstance(providers, dict) else {}
        if not isinstance(item, dict):
            item = {}
        reply_mode = str(item.get("replyMode", "webhook") or "webhook").strip()
        if reply_mode not in {"webhook", "official_api"}:
            reply_mode = "webhook"
        return {
            "replyMode": reply_mode,
            "replyWebhookUrl": str(item.get("replyWebhookUrl", "") or "").strip(),
            "verificationToken": str(item.get("verificationToken", "") or "").strip(),
            "signingSecret": str(item.get("signingSecret", "") or "").strip(),
            "officialApiBaseUrl": str(item.get("officialApiBaseUrl", "") or "").strip(),
            "officialAppId": str(item.get("officialAppId", "") or "").strip(),
            "officialAppSecret": str(item.get("officialAppSecret", "") or "").strip(),
            "officialTargetId": str(item.get("officialTargetId", "") or "").strip(),
            "officialTargetIdType": str(item.get("officialTargetIdType", "") or "").strip(),
            "officialRobotCode": str(item.get("officialRobotCode", "") or "").strip(),
            "officialConversationId": str(item.get("officialConversationId", "") or "").strip(),
        }

    default_provider = str(source.get("defaultProvider", default["defaultProvider"]) or "generic").strip()
    if default_provider not in {"generic", "feishu", "dingtalk"}:
        default_provider = "generic"

    return {
        "enabled": bool(source.get("enabled", default["enabled"])),
        "publicBaseUrl": str(source.get("publicBaseUrl", "") or "").strip(),
        "accessToken": str(source.get("accessToken", "") or "").strip(),
        "defaultProvider": default_provider,
        "autoReply": bool(source.get("autoReply", default["autoReply"])),
        "commandPrefix": str(source.get("commandPrefix", "") or "").strip(),
        "providers": {
            "generic": provider_config("generic"),
            "feishu": provider_config("feishu"),
            "dingtalk": provider_config("dingtalk"),
        },
    }


def load_im_bridge_config() -> dict[str, Any]:
    return normalize_im_bridge_config(read_json(im_bridge_config_path(), default_im_bridge_config()))


def load_im_bridge_events() -> list[dict[str, Any]]:
    raw = read_json(im_bridge_events_path(), [])
    return raw if isinstance(raw, list) else []


def save_im_bridge_events(events: list[dict[str, Any]]) -> None:
    write_json(im_bridge_events_path(), events[:100])


def append_im_bridge_event(event: dict[str, Any]) -> dict[str, Any]:
    record = {
        "id": str(event.get("id") or uuid.uuid4()),
        "createdAt": int(event.get("createdAt") or now_ms()),
        "provider": str(event.get("provider") or "generic"),
        "kind": str(event.get("kind") or "inbound"),
        "status": str(event.get("status") or "completed"),
        "sessionId": str(event.get("sessionId") or "").strip(),
        "commandText": str(event.get("commandText") or "").strip(),
        "requestText": str(event.get("requestText") or "").strip(),
        "resultText": str(event.get("resultText") or "").strip(),
        "resultPreview": str(event.get("resultPreview") or "").strip(),
        "delivered": bool(event.get("delivered", False)),
        "error": str(event.get("error") or "").strip(),
        "retryable": bool(event.get("retryable", False)),
        "sourceEventId": str(event.get("sourceEventId") or "").strip(),
    }
    events = load_im_bridge_events()
    events.insert(0, record)
    save_im_bridge_events(events)
    return record


def save_im_bridge_config(config: dict[str, Any]) -> dict[str, Any]:
    normalized = normalize_im_bridge_config(config)
    write_json(im_bridge_config_path(), normalized)
    return normalized


def load_last_llm_config() -> OpenClawLlmPayload | None:
    raw = read_json(llm_config_path(), None)
    if not isinstance(raw, dict):
        return None
    try:
        llm = OpenClawLlmPayload.model_validate(raw)
    except Exception:
        return None
    if not (llm.apiKey or "").strip():
        return None
    if not (llm.baseUrl or "").strip():
        return None
    if not (llm.model or "").strip():
        return None
    return llm


def save_last_llm_config(payload: OpenClawLlmPayload) -> None:
    if not (payload.apiKey or "").strip():
        return
    if not (payload.baseUrl or "").strip():
        return
    if not (payload.model or "").strip():
        return
    write_json(llm_config_path(), payload.model_dump())


def resolve_llm_config(payload: OpenClawLlmPayload | None) -> OpenClawLlmPayload | None:
    if payload is not None:
        api_key = (payload.apiKey or "").strip()
        base_url = (payload.baseUrl or "").strip()
        model = (payload.model or "").strip()
        if api_key and base_url and model:
            save_last_llm_config(payload)
            return payload
    return load_last_llm_config()


def llm_payload_to_bridge_config(payload: OpenClawLlmPayload | None) -> LobsterLlmConfig | None:
    resolved = resolve_llm_config(payload)
    if resolved is None:
        return None
    return LobsterLlmConfig(
        provider=(resolved.provider or "openai").strip() or "openai",
        api_key=(resolved.apiKey or "").strip(),
        base_url=(resolved.baseUrl or "").strip(),
        model=(resolved.model or "").strip(),
    )


def build_copy_message(style: str, topic: str) -> str:
    system_prompt = SYSTEM_PROMPT_BY_STYLE.get(style, SYSTEM_PROMPT_BY_STYLE["xiaohongshu"])
    return (
        "请根据以下系统设定生成可直接发布的文案。\n"
        "只输出最终文案本身，不要解释你的思考过程。\n\n"
        f"系统设定：{system_prompt}\n\n"
        f"用户输入：{topic}"
    )


def build_vault_message(query: str, folder_name: str, files: list[VaultFilePayload]) -> str:
    file_list = "\n".join(
        f"- {item.name} ({round(max(item.size, 0) / 1024)}KB)"
        for item in files[:40]
    )
    return (
        "你是知识库检索助手。用户会给你一个文件列表（仅文件名/大小）和一个问题。\n"
        "你的任务是：\n"
        "1) 从列表里挑出最相关的 3 个文件名（如果没有就说没有）。\n"
        "2) 给出可执行的下一步：为了回答得更准，需要用户提供哪些关键信息或把哪些文件内容粘贴出来。\n"
        "注意：当前你看不到文件内容，只能基于文件名进行初步判断。\n\n"
        f"当前文件夹：{folder_name}\n"
        f"文件列表：\n{file_list or '(空)'}\n\n"
        f"用户问题：{query}\n\n"
        "请用简洁的 Markdown 输出：\n"
        "【最相关文件】\n- ...\n【建议】\n- ..."
    )


async def call_lobster_text(
    *,
    message: str,
    session_id: str,
    timeout_seconds: int,
    llm_payload: OpenClawLlmPayload | None,
    system_prompt: str = "",
    use_lobster_skills: bool = True,
    workspace_context: dict[str, Any] | None = None,
) -> str:
    llm = llm_payload_to_bridge_config(llm_payload)
    if llm is None:
        raise ValueError("缺少大模型配置，请先在设置中填写 API Key。")

    request = LobsterAgentRequest(
        message=message,
        session_id=session_id,
        timeout_seconds=timeout_seconds,
        llm=llm,
        system_prompt=system_prompt,
        use_lobster_skills=use_lobster_skills,
        workspace_context=workspace_context or {},
    )
    return (await run_lobster_agent(request)).strip()


def ensure_data_url_from_base64(maybe_base64: str) -> str | None:
    value = maybe_base64.strip()
    if not value:
        return None
    if value.startswith("data:"):
        return value
    return f"data:image/png;base64,{value}"


def extract_json_from_text(text: str) -> Any:
    trimmed = text.strip()
    if not trimmed:
        return None

    try:
        return json.loads(trimmed)
    except Exception:
        pass

    fence = re.search(r"```json\s*([\s\S]*?)\s*```", trimmed, flags=re.IGNORECASE)
    if fence:
        try:
            return json.loads(fence.group(1).strip())
        except Exception:
            pass

    first_brace = trimmed.find("{")
    last_brace = trimmed.rfind("}")
    if first_brace >= 0 and last_brace > first_brace:
        candidate = trimmed[first_brace : last_brace + 1]
        try:
            return json.loads(candidate)
        except Exception:
            pass

    return None


def parse_output_from_unknown(payload: Any) -> dict[str, str | None] | None:
    if not isinstance(payload, dict):
        return None

    output = payload.get("output") or payload.get("result") or payload.get("data") or payload

    if not isinstance(output, dict):
        return None

    direct_video = (
        output.get("videoSrc")
        or output.get("video_url")
        or output.get("videoUrl")
        or output.get("clip_video_url")
        or output.get("clipVideoUrl")
        or output.get("video")
    )
    direct_cover = (
        output.get("coverSrc")
        or output.get("cover_url")
        or output.get("coverUrl")
        or output.get("cover_image_url")
        or output.get("coverImageUrl")
        or output.get("cover")
        or output.get("image")
    )
    direct_cover_base64 = (
        output.get("coverBase64")
        or output.get("cover_base64")
        or output.get("cover_image_base64")
        or output.get("coverImageBase64")
    )

    video_src = direct_video if isinstance(direct_video, str) else None
    if not video_src and isinstance(direct_video, dict):
        nested_url = direct_video.get("url")
        video_src = nested_url if isinstance(nested_url, str) else None

    cover_src = direct_cover if isinstance(direct_cover, str) else None
    if not cover_src and isinstance(direct_cover, dict):
        nested_url = direct_cover.get("url")
        cover_src = nested_url if isinstance(nested_url, str) else None
    if not cover_src and isinstance(direct_cover_base64, str):
        cover_src = ensure_data_url_from_base64(direct_cover_base64)

    if not video_src and not cover_src:
        return None
    return {"videoSrc": video_src, "coverSrc": cover_src}


def is_hms(value: Any) -> bool:
    return isinstance(value, str) and bool(re.fullmatch(r"\d{2}:\d{2}:\d{2}", value.strip()))


def pad2(value: int) -> str:
    return str(max(0, int(value))).zfill(2)


def seconds_to_hms(seconds: int) -> str:
    total = max(0, int(seconds))
    hours = total // 3600
    minutes = (total % 3600) // 60
    secs = total % 60
    return f"{pad2(hours)}:{pad2(minutes)}:{pad2(secs)}"


def parse_cover_timestamp(prompt: str) -> str:
    hms = re.search(r"\b(\d{1,2}):(\d{2}):(\d{2})\b", prompt)
    if hms:
        return f"{pad2(int(hms.group(1)))}:{pad2(int(hms.group(2)))}:{pad2(int(hms.group(3)))}"
    second = re.search(r"第\s*(\d+)\s*秒", prompt)
    if second:
        return seconds_to_hms(int(second.group(1)))
    around = re.search(r"(?:在|到)\s*(\d+)\s*秒", prompt)
    if around:
        return seconds_to_hms(int(around.group(1)))
    return "00:00:10"


def parse_clip_seconds(prompt: str) -> int | None:
    for pattern in (
        r"前\s*(\d+)\s*(秒钟|秒)",
        r"截取\s*(\d+)\s*(秒钟|秒)",
        r"(?:截取|剪辑|剪|保留|输出|生成)\s*(?:一段|成片|片段|视频)?\s*(\d+)\s*(秒钟|秒)(?!\d)",
        r"剪.*?(\d+)\s*(秒钟|秒)(?!\d)",
    ):
        match = re.search(pattern, prompt)
        if match:
            return int(match.group(1))
    if re.search(r"(高光|剪辑|片段|成片)", prompt):
        return 15
    return None


def parse_clip_start_seconds(prompt: str) -> int:
    for pattern in (r"从第?\s*(\d+)\s*秒\s*(?:开始|起)?", r"从\s*(\d+)\s*秒\s*(?:开始|起)?"):
        match = re.search(pattern, prompt)
        if match:
            return int(match.group(1))
    return 0


async def try_plan_with_lobster(prompt: str) -> dict[str, Any] | None:
    llm = load_last_llm_config()
    if llm is None:
        return None

    message = (
        "你是视频处理参数解析器。用户会给你一段中文指令。\n"
        "请你只输出严格 JSON（不要代码块、不要解释），schema：\n"
        '{"coverTime":"HH:MM:SS","clipStartSeconds":number,"clipSeconds":number|null}\n'
        "规则：\n"
        "- coverTime 默认 00:00:10\n"
        "- clipStartSeconds 默认 0\n"
        "- 如果用户没有要求剪辑片段，clipSeconds 返回 null；否则返回秒数（整数）\n\n"
        f"用户指令：{prompt}"
    )
    try:
        text = await call_lobster_text(
            message=message,
            session_id="desktop-video-plan",
            timeout_seconds=45,
            llm_payload=llm,
            use_lobster_skills=False,
        )
    except Exception:
        return None

    data = extract_json_from_text(text)
    if not isinstance(data, dict):
        return None

    result: dict[str, Any] = {}
    if is_hms(data.get("coverTime")):
        result["coverTime"] = data["coverTime"]
    clip_start = data.get("clipStartSeconds")
    if isinstance(clip_start, (int, float)):
        result["clipStartSeconds"] = max(0, int(clip_start))
    clip_seconds = data.get("clipSeconds")
    if clip_seconds is None:
        result["clipSeconds"] = None
    elif isinstance(clip_seconds, (int, float)):
        result["clipSeconds"] = max(1, int(clip_seconds))
    return result if result else None


def safe_filename(name: str) -> str:
    sanitized = re.sub(r"[^\w.\-() ]+", "_", name).strip()
    return sanitized or f"file-{uuid.uuid4().hex}"


async def save_uploaded_file(upload: UploadFile) -> str:
    filename = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}-{safe_filename(upload.filename or 'upload.bin')}"
    destination = uploads_root() / filename
    data = await upload.read()
    destination.write_bytes(data)
    await upload.close()
    return str(destination)


async def run_ffmpeg(args: list[str]) -> None:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("未检测到 ffmpeg，请先安装 ffmpeg 再使用本地视频处理。")

    process = await asyncio.create_subprocess_exec(
        ffmpeg,
        *args,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await process.communicate()
    if process.returncode != 0:
        raise RuntimeError((stderr or b"").decode("utf-8", errors="ignore").strip() or f"ffmpeg exited with code {process.returncode}")


def request_base_url(request: Request) -> str:
    return str(request.base_url).rstrip("/")


def build_asset_url(request: Request, name: str) -> str:
    return f"{request_base_url(request)}/api/openclaw/assets/{quote(name)}"


async def local_video_frames_execute(*, request: Request, prompt: str, file_url: str) -> dict[str, Any]:
    root = outputs_root()
    identifier = f"{int(time.time() * 1000)}-{uuid.uuid4().hex[:8]}"

    plan = await try_plan_with_lobster(prompt)
    cover_time = str(plan.get("coverTime")) if isinstance(plan, dict) and plan.get("coverTime") else parse_cover_timestamp(prompt)

    cover_name = f"{identifier}-cover.png"
    cover_path = root / cover_name

    async def extract_cover(target_time: str) -> None:
        await run_ffmpeg(
            [
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-ss",
                target_time,
                "-i",
                file_url,
                "-frames:v",
                "1",
                "-vf",
                "scale=1280:-1",
                str(cover_path),
            ]
        )

    try:
        await extract_cover(cover_time)
    except Exception:
        cover_time = "00:00:00"
        await extract_cover(cover_time)

    if not cover_path.exists():
        cover_time = "00:00:00"
        await extract_cover(cover_time)

    cover_src = ensure_data_url_from_base64(base64.b64encode(cover_path.read_bytes()).decode("ascii"))
    if cover_src is None:
        raise RuntimeError("封面生成失败")

    clip_seconds = plan.get("clipSeconds") if isinstance(plan, dict) else None
    if not isinstance(clip_seconds, int) and clip_seconds is not None:
        clip_seconds = None
    if clip_seconds is None:
        clip_seconds = parse_clip_seconds(prompt)

    clip_start_seconds = plan.get("clipStartSeconds") if isinstance(plan, dict) else None
    if not isinstance(clip_start_seconds, int):
        clip_start_seconds = parse_clip_start_seconds(prompt)

    video_src: str | None = None
    clip_path: str | None = None

    if isinstance(clip_seconds, int) and clip_seconds > 0:
        clip_name = f"{identifier}-clip.mp4"
        target_clip = root / clip_name
        try:
            await run_ffmpeg(
                [
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    str(max(0, clip_start_seconds)),
                    "-i",
                    file_url,
                    "-t",
                    str(max(1, clip_seconds)),
                    "-c",
                    "copy",
                    "-movflags",
                    "+faststart",
                    str(target_clip),
                ]
            )
        except Exception:
            await run_ffmpeg(
                [
                    "-y",
                    "-hide_banner",
                    "-loglevel",
                    "error",
                    "-ss",
                    str(max(0, clip_start_seconds)),
                    "-i",
                    file_url,
                    "-t",
                    str(max(1, clip_seconds)),
                    "-c:v",
                    "libx264",
                    "-preset",
                    "veryfast",
                    "-crf",
                    "23",
                    "-c:a",
                    "aac",
                    "-movflags",
                    "+faststart",
                    str(target_clip),
                ]
            )
        video_src = build_asset_url(request, clip_name)
        clip_path = str(target_clip)

    return {
        "ok": True,
        "output": {
            "videoSrc": video_src,
            "coverSrc": cover_src,
        },
        "raw": {
            "mode": "local-video-frames",
            "coverTime": cover_time,
            "clipSeconds": clip_seconds,
            "clipStartSeconds": clip_start_seconds,
            "fileUrl": file_url,
            "coverPath": str(cover_path),
            "clipPath": clip_path,
        },
        "note": "OpenClaw 引擎不可达，已使用本地 video-frames (ffmpeg) 完成处理",
    }


async def call_openclaw_chat(*, engine_url: str, token: str, prompt: str, file_url: str) -> tuple[int, str]:
    controller_timeout = httpx.Timeout(60.0, connect=20.0)
    url = f"{engine_url.rstrip('/')}/v1/chat/completions"
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if token:
        headers.update(
            {
                "Authorization": f"Bearer {token}",
                "X-API-Token": token,
                "X-OpenClaw-Token": token,
                "X-OpenClaw-Gateway-Token": token,
            }
        )

    payload = {
        "model": "openclaw",
        "stream": False,
        "temperature": 0.2,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是 OpenClaw 引擎的 Agent 执行器。你的目标是基于用户指令，对给定视频文件调用 video-frames 能力完成："
                    "抽帧生成封面 + 产出剪辑后片段（如果需要）。"
                    "请严格只返回 JSON，不要输出其它文字。JSON schema："
                    '{"videoSrc":string|null,"coverSrc":string|null,"coverBase64":string|null}。'
                    "coverBase64 为纯 base64（不含 data: 前缀）。如果只能返回其中之一，另一个置 null。"
                ),
            },
            {
                "role": "user",
                "content": f"用户指令：{prompt}\n视频文件路径(fileUrl)：{file_url}\n请开始执行。",
            },
        ],
    }

    async with httpx.AsyncClient(timeout=controller_timeout) as client:
        response = await client.post(url, json=payload, headers=headers)
        return response.status_code, response.text


async def close_stream_resources(upstream: httpx.Response, client: httpx.AsyncClient) -> None:
    await upstream.aclose()
    await client.aclose()


async def fetch_connector_text(url: str, timeout_ms: int) -> tuple[bool, int, str]:
    timeout = httpx.Timeout(timeout_ms / 1000, connect=min(5.0, timeout_ms / 1000))
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            response = await client.get(url)
            return response.is_success, response.status_code, response.text
        except Exception as exc:
            return False, 0, str(exc)


def build_im_bridge_callback_urls(config: dict[str, Any]) -> dict[str, str]:
    public_base_url = normalize_base_url(str(config.get("publicBaseUrl", "") or ""))
    if not public_base_url:
        return {
            "generic": "",
            "feishu": "",
            "dingtalk": "",
        }
    return {
        "generic": f"{public_base_url}/api/im-bridge/inbound/generic",
        "feishu": f"{public_base_url}/api/im-bridge/inbound/feishu",
        "dingtalk": f"{public_base_url}/api/im-bridge/inbound/dingtalk",
    }


def get_im_bridge_health(config: dict[str, Any] | None = None) -> dict[str, Any]:
    bridge = load_im_bridge_config() if config is None else normalize_im_bridge_config(config)
    callback_urls = build_im_bridge_callback_urls(bridge)
    provider_status = {
        provider_id: {
            "replyConfigured": bool(str(bridge.get("providers", {}).get(provider_id, {}).get("replyWebhookUrl", "") or "").strip()),
            "authConfigured": bool(
                str(bridge.get("providers", {}).get(provider_id, {}).get("verificationToken", "") or "").strip()
                or str(bridge.get("providers", {}).get(provider_id, {}).get("signingSecret", "") or "").strip()
            ),
            "officialApiConfigured": bool(
                str(bridge.get("providers", {}).get(provider_id, {}).get("officialAppId", "") or "").strip()
                and str(bridge.get("providers", {}).get(provider_id, {}).get("officialAppSecret", "") or "").strip()
            ),
        }
        for provider_id in ("generic", "feishu", "dingtalk")
    }
    configured = bool(bridge.get("enabled")) and bool(callback_urls[bridge.get("defaultProvider", "generic")]) and bool(
        str(bridge.get("accessToken", "") or "").strip()
    )

    if not bridge.get("enabled"):
        next_action = "在桌面设置中启用移动端接入，并填写公网回调地址。"
    elif not str(bridge.get("publicBaseUrl", "") or "").strip():
        next_action = "请先通过 Cloudflare Tunnel / ngrok / FRP 暴露本地 sidecar，并把公网地址填入 Public Base URL。"
    elif not str(bridge.get("accessToken", "") or "").strip():
        next_action = "请为 IM Bridge 设置共享访问令牌，避免公网回调被未授权触发。"
    else:
        next_action = "将对应 callback URL 填入钉钉/飞书自动化或机器人回调，并发送一条测试指令。"

    return {
        "enabled": bool(bridge.get("enabled")),
        "configured": configured,
        "defaultProvider": bridge.get("defaultProvider", "generic"),
        "publicBaseUrl": str(bridge.get("publicBaseUrl", "") or "").strip(),
        "authModes": {
            "bearerHeader": "Authorization: Bearer <Access Token>",
            "customHeader": "X-AgentCore-IM-Token: <Access Token>",
            "queryParam": "?token=<Access Token>",
        },
        "callbackUrls": callback_urls,
        "providerStatus": provider_status,
        "nextAction": next_action,
    }


def extract_remote_text(provider: str, payload: dict[str, Any]) -> str:
    if provider == "generic":
        for key in ("text", "command", "message", "content"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        content_node = payload.get("content")
        if isinstance(content_node, dict):
            for key in ("text", "content", "message"):
                value = content_node.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        return ""

    if provider == "feishu":
        challenge = payload.get("challenge")
        if isinstance(challenge, str) and challenge.strip():
            return ""
        event = payload.get("event") if isinstance(payload.get("event"), dict) else {}
        message = event.get("message") if isinstance(event.get("message"), dict) else {}
        content_raw = message.get("content")
        if isinstance(content_raw, str) and content_raw.strip():
            try:
                content_json = json.loads(content_raw)
            except Exception:
                content_json = {}
            if isinstance(content_json, dict):
                text = content_json.get("text")
                if isinstance(text, str) and text.strip():
                    return text.strip()
        for key in ("text", "command", "message"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    if provider == "dingtalk":
        text_node = payload.get("text")
        if isinstance(text_node, dict):
            content = text_node.get("content")
            if isinstance(content, str) and content.strip():
                return content.strip()
        body_node = payload.get("content")
        if isinstance(body_node, dict):
            for key in ("text", "content", "message"):
                value = body_node.get(key)
                if isinstance(value, str) and value.strip():
                    return value.strip()
        for key in ("text", "command", "message", "content"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return ""

    return ""


def extract_remote_session_id(provider: str, payload: dict[str, Any]) -> str:
    if provider == "feishu":
        event = payload.get("event") if isinstance(payload.get("event"), dict) else {}
        sender = event.get("sender") if isinstance(event.get("sender"), dict) else {}
        sender_id = sender.get("sender_id") if isinstance(sender.get("sender_id"), dict) else {}
        message = event.get("message") if isinstance(event.get("message"), dict) else {}
        candidates = [
            message.get("chat_id"),
            message.get("message_id"),
            sender_id.get("open_id"),
            sender_id.get("user_id"),
            sender_id.get("union_id"),
        ]
        for value in candidates:
            if isinstance(value, str) and value.strip():
                return f"im-{provider}-{value.strip()}"

    if provider == "dingtalk":
        sender_id = payload.get("senderId")
        sender_staff_id = payload.get("senderStaffId")
        conversation_id = payload.get("conversationId")
        session_webhook = payload.get("sessionWebhook")
        candidates = [
            conversation_id,
            sender_staff_id,
            sender_id,
            session_webhook,
            payload.get("chatbotUserId"),
        ]
        for value in candidates:
            if isinstance(value, str) and value.strip():
                return f"im-{provider}-{value.strip()}"

    candidates = [
        payload.get("sessionId"),
        payload.get("conversationId"),
        payload.get("chatId"),
        payload.get("userId"),
        payload.get("senderId"),
    ]
    for value in candidates:
        if isinstance(value, str) and value.strip():
            return f"im-{provider}-{value.strip()}"
    return f"im-{provider}-{uuid.uuid4().hex[:8]}"


def get_reply_webhook_url(provider: str, payload: dict[str, Any], config: dict[str, Any]) -> str:
    direct = payload.get("replyWebhookUrl")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    providers = config.get("providers", {}) if isinstance(config.get("providers"), dict) else {}
    provider_config = providers.get(provider, {}) if isinstance(providers.get(provider), dict) else {}
    configured = provider_config.get("replyWebhookUrl")
    return str(configured or "").strip()


def get_im_provider_config(provider: str, config: dict[str, Any]) -> dict[str, Any]:
    providers = config.get("providers", {}) if isinstance(config.get("providers"), dict) else {}
    item = providers.get(provider, {}) if isinstance(providers.get(provider), dict) else {}
    return item


def build_im_event_preview(text: str, limit: int = 220) -> str:
    trimmed = " ".join(text.strip().split())
    if len(trimmed) <= limit:
        return trimmed
    return f"{trimmed[: limit - 1]}..."


def resolve_feishu_receive_id(provider_config: dict[str, Any], payload: dict[str, Any] | None) -> tuple[str, str]:
    configured_receive_id = str(provider_config.get("officialTargetId", "") or "").strip()
    receive_id_type = str(provider_config.get("officialTargetIdType", "") or "chat_id").strip() or "chat_id"
    if configured_receive_id:
        return configured_receive_id, receive_id_type

    data = payload or {}
    event = data.get("event") if isinstance(data.get("event"), dict) else {}
    message = event.get("message") if isinstance(event.get("message"), dict) else {}
    sender = event.get("sender") if isinstance(event.get("sender"), dict) else {}
    sender_id = sender.get("sender_id") if isinstance(sender.get("sender_id"), dict) else {}

    if receive_id_type == "open_id":
        candidate = str(sender_id.get("open_id", "") or "").strip()
        if candidate:
            return candidate, receive_id_type
    if receive_id_type == "user_id":
        candidate = str(sender_id.get("user_id", "") or "").strip()
        if candidate:
            return candidate, receive_id_type

    chat_id = str(message.get("chat_id", "") or "").strip()
    if chat_id:
        return chat_id, "chat_id"

    return "", receive_id_type


def resolve_dingtalk_conversation_id(provider_config: dict[str, Any], payload: dict[str, Any] | None) -> str:
    configured = str(provider_config.get("officialConversationId", "") or "").strip()
    if configured:
        return configured
    data = payload or {}
    for key in ("conversationId", "openConversationId"):
        value = str(data.get(key, "") or "").strip()
        if value:
            return value
    return ""


async def execute_im_bridge_command(
    *,
    provider: str,
    text: str,
    session_id: str,
    config: dict[str, Any],
    reply_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    llm = load_last_llm_config()
    if llm is None:
        return {
            "ok": False,
            "statusCode": 409,
            "status": "blocked",
            "text": "桌面尚未保存大模型配置，请先在 AgentCore OS 设置中完成 API Key 配置。",
            "delivered": False,
            "error": "桌面尚未保存大模型配置",
        }

    try:
        result_text = await call_lobster_text(
            message=text,
            session_id=session_id,
            timeout_seconds=120,
            llm_payload=llm,
            system_prompt=REMOTE_OFFICE_SYSTEM_PROMPT,
            workspace_context={"source": f"im:{provider}", "mode": "remote_office"},
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or exc.response.reason_phrase
        result_text = f"执行失败：模型接口返回 HTTP {exc.response.status_code}，{detail[:240]}"
    except Exception as exc:
        result_text = f"执行失败：{exc}"

    delivered = False
    status = "failed" if result_text.startswith("执行失败：") else "completed"
    if config.get("autoReply", True):
        delivered = await deliver_im_reply_via_config(provider, config, result_text, reply_payload)

    return {
        "ok": True,
        "statusCode": 200,
        "status": status,
        "text": result_text,
        "delivered": delivered,
        "error": build_im_event_preview(result_text) if status == "failed" else "",
    }


async def deliver_im_reply(provider: str, webhook_url: str, text: str) -> bool:
    if not webhook_url.strip():
        return False

    if provider == "feishu":
        payload: dict[str, Any] = {
            "msg_type": "text",
            "content": {"text": text},
        }
    elif provider == "dingtalk":
        payload = {
            "msgtype": "text",
            "text": {"content": text},
        }
    else:
        payload = {
            "text": text,
            "provider": "agentcore",
        }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0)) as client:
            response = await client.post(webhook_url, json=payload)
            return response.is_success
    except Exception:
        return False


async def deliver_feishu_official_reply(provider_config: dict[str, Any], text: str, payload: dict[str, Any] | None) -> bool:
    base_url = normalize_base_url(str(provider_config.get("officialApiBaseUrl", "") or "https://open.feishu.cn"))
    app_id = str(provider_config.get("officialAppId", "") or "").strip()
    app_secret = str(provider_config.get("officialAppSecret", "") or "").strip()
    receive_id, receive_id_type = resolve_feishu_receive_id(provider_config, payload)
    if not base_url or not app_id or not app_secret or not receive_id:
        return False

    token_url = f"{base_url.rstrip('/')}/open-apis/auth/v3/tenant_access_token/internal"
    send_url = f"{base_url.rstrip('/')}/open-apis/im/v1/messages?receive_id_type={quote(receive_id_type, safe='')}"
    timeout = httpx.Timeout(20.0, connect=8.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            token_response = await client.post(
                token_url,
                json={"app_id": app_id, "app_secret": app_secret},
            )
            token_payload = token_response.json()
            tenant_access_token = str(token_payload.get("tenant_access_token", "") or "").strip()
            if not token_response.is_success or not tenant_access_token:
                return False
            message_response = await client.post(
                send_url,
                headers={"Authorization": f"Bearer {tenant_access_token}"},
                json={
                    "receive_id": receive_id,
                    "msg_type": "text",
                    "content": json.dumps({"text": text}, ensure_ascii=False),
                },
            )
            return message_response.is_success
    except Exception:
        return False


async def deliver_dingtalk_official_reply(provider_config: dict[str, Any], text: str, payload: dict[str, Any] | None) -> bool:
    base_url = normalize_base_url(str(provider_config.get("officialApiBaseUrl", "") or "https://api.dingtalk.com"))
    app_id = str(provider_config.get("officialAppId", "") or "").strip()
    app_secret = str(provider_config.get("officialAppSecret", "") or "").strip()
    robot_code = str(provider_config.get("officialRobotCode", "") or "").strip()
    conversation_id = resolve_dingtalk_conversation_id(provider_config, payload)
    if not base_url or not app_id or not app_secret or not robot_code or not conversation_id:
        return False

    token_url = f"{base_url.rstrip('/')}/v1.0/oauth2/accessToken"
    send_url = f"{base_url.rstrip('/')}/v1.0/robot/groupMessages/send"
    timeout = httpx.Timeout(20.0, connect=8.0)
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            token_response = await client.post(
                token_url,
                json={"appKey": app_id, "appSecret": app_secret},
            )
            token_payload = token_response.json()
            access_token = str(token_payload.get("accessToken", "") or token_payload.get("access_token", "") or "").strip()
            if not token_response.is_success or not access_token:
                return False
            message_response = await client.post(
                send_url,
                headers={"x-acs-dingtalk-access-token": access_token},
                json={
                    "robotCode": robot_code,
                    "openConversationId": conversation_id,
                    "msgKey": "sampleText",
                    "msgParam": json.dumps({"content": text}, ensure_ascii=False),
                },
            )
            return message_response.is_success
    except Exception:
        return False


async def deliver_im_reply_via_config(
    provider: str,
    config: dict[str, Any],
    text: str,
    payload: dict[str, Any] | None = None,
) -> bool:
    provider_config = get_im_provider_config(provider, config)
    reply_mode = str(provider_config.get("replyMode", "webhook") or "webhook").strip()
    if provider == "feishu" and reply_mode == "official_api":
        delivered = await deliver_feishu_official_reply(provider_config, text, payload)
        if delivered:
            return True
    if provider == "dingtalk" and reply_mode == "official_api":
        delivered = await deliver_dingtalk_official_reply(provider_config, text, payload)
        if delivered:
            return True

    webhook_url = get_reply_webhook_url(provider, payload or {}, config)
    return await deliver_im_reply(provider, webhook_url, text)


def authorize_im_bridge(request: Request, config: dict[str, Any]) -> bool:
    expected = str(config.get("accessToken", "") or "").strip()
    if not expected:
        return True

    auth_header = request.headers.get("authorization", "").strip()
    bridge_header = request.headers.get("x-agentcore-im-token", "").strip()
    token = ""
    if auth_header.lower().startswith("bearer "):
        token = auth_header[7:].strip()
    elif bridge_header:
        token = bridge_header
    else:
        for query_key in ("token", "access_token", "accessToken"):
            query_value = request.query_params.get(query_key, "").strip()
            if query_value:
                token = query_value
                break
    return token == expected


def authorize_feishu_request(payload: dict[str, Any], config: dict[str, Any]) -> bool:
    providers = config.get("providers", {}) if isinstance(config.get("providers"), dict) else {}
    feishu_config = providers.get("feishu", {}) if isinstance(providers.get("feishu"), dict) else {}
    expected_token = str(feishu_config.get("verificationToken", "") or "").strip()
    if not expected_token:
        return True
    actual_token = str(payload.get("token", "") or "").strip()
    return bool(actual_token) and hmac.compare_digest(actual_token, expected_token)


def authorize_dingtalk_request(request: Request, config: dict[str, Any]) -> bool:
    providers = config.get("providers", {}) if isinstance(config.get("providers"), dict) else {}
    dingtalk_config = providers.get("dingtalk", {}) if isinstance(providers.get("dingtalk"), dict) else {}
    signing_secret = str(dingtalk_config.get("signingSecret", "") or "").strip()
    if not signing_secret:
        return True

    timestamp = request.query_params.get("timestamp", "").strip()
    sign = request.query_params.get("sign", "").strip()
    if not timestamp or not sign:
        return False

    string_to_sign = f"{timestamp}\n{signing_secret}".encode("utf-8")
    digest = hmac.new(signing_secret.encode("utf-8"), string_to_sign, digestmod=hashlib.sha256).digest()
    expected_sign = base64.b64encode(digest).decode("utf-8")
    return hmac.compare_digest(sign, expected_sign)


async def heartbeat_monitor() -> None:
    global last_heartbeat_at
    while True:
        await asyncio.sleep(2)
        if time.time() - last_heartbeat_at > HEARTBEAT_TIMEOUT_SECONDS:
            print(
                f"[{APP_NAME}] heartbeat timeout after {HEARTBEAT_TIMEOUT_SECONDS}s; exiting process tree",
                flush=True,
            )
            os._exit(0)


app.add_middleware(
    CORSMiddleware,
    allow_origins=parse_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": APP_NAME,
    }


@app.post(HEARTBEAT_PATH)
async def heartbeat() -> dict[str, Any]:
    global last_heartbeat_at
    last_heartbeat_at = time.time()
    return {"status": "alive", "timestamp": last_heartbeat_at}


@app.get("/_agentcore/runtime-contract")
async def runtime_contract() -> dict[str, Any]:
    return {
        "status": "ok",
        "heartbeatPath": HEARTBEAT_PATH,
        "heartbeatTimeoutSeconds": HEARTBEAT_TIMEOUT_SECONDS,
        "allowedOrigins": parse_allowed_origins(),
        "port": os.getenv("PORT", "8080"),
    }


@app.get("/api/runtime/doctor")
async def runtime_doctor() -> dict[str, Any]:
    return {"ok": True, "report": get_runtime_doctor_report()}


@app.get("/api/desktop/settings")
async def desktop_settings_get() -> dict[str, Any]:
    return {"ok": True, "data": {"settings": load_desktop_settings()}}


@app.put("/api/desktop/settings")
async def desktop_settings_put(request: Request) -> JSONResponse:
    try:
        payload = await request.json()
    except Exception:
        payload = None
    if not isinstance(payload, dict):
        return JSONResponse(
            {"ok": False, "error": "Invalid settings payload."},
            status_code=400,
        )

    save_desktop_settings(payload)
    return JSONResponse(
        {"ok": True, "data": {"settings": payload}},
        status_code=200,
    )


@app.get("/api/runtime/sidecar")
async def runtime_sidecar_get() -> dict[str, Any]:
    return {"ok": True, "status": get_runtime_sidecar_status()}


@app.post("/api/runtime/sidecar")
async def runtime_sidecar_post(payload: RuntimeSidecarActionPayload) -> JSONResponse:
    state = load_runtime_state()
    action = payload.action
    config = sanitize_runtime_config(
        payload.config.model_dump() if payload.config is not None else state["config"]
    )
    ok, message = execute_runtime_action(action, config)

    state["lastAction"] = {
        "type": action,
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ok": ok,
        "message": message,
    }
    state["config"] = config
    save_runtime_state(state)
    status = get_runtime_sidecar_status()
    return JSONResponse(
        {
            "ok": ok,
            "status": status,
            "error": None if ok else message,
        },
        status_code=200 if ok else 400,
    )


@app.get("/api/publish/config")
async def publish_config_get() -> dict[str, Any]:
    return {"ok": True, "data": {"matrixAccounts": load_publish_config()}}


@app.put("/api/publish/config")
async def publish_config_put(payload: PublishConfigPayload) -> dict[str, Any]:
    save_publish_config(payload.matrixAccounts)
    return {"ok": True, "data": {"matrixAccounts": payload.matrixAccounts}}


@app.get("/api/publish/jobs")
async def publish_jobs_get() -> dict[str, Any]:
    return {"ok": True, "data": {"jobs": load_publish_jobs()}}


@app.post("/api/publish/jobs")
async def publish_jobs_post(payload: PublishJobCreatePayload) -> dict[str, Any]:
    jobs = load_publish_jobs()
    record = {
        "id": str(uuid.uuid4()),
        "draftId": payload.draftId,
        "draftTitle": payload.draftTitle,
        "draftBody": payload.draftBody,
        "platforms": payload.platforms,
        "mode": payload.mode or "dry-run",
        "status": payload.status or "queued",
        "attempts": 0,
        "maxAttempts": payload.maxAttempts or 1,
        "createdAt": now_ms(),
        "updatedAt": now_ms(),
    }
    jobs.insert(0, record)
    save_publish_jobs(jobs)
    return {"ok": True, "data": {"job": record}}


@app.patch("/api/publish/jobs/{job_id}")
async def publish_jobs_patch(job_id: str, payload: PublishJobPatchPayload) -> dict[str, Any]:
    jobs = load_publish_jobs()
    for index, job in enumerate(jobs):
        if job["id"] != job_id:
            continue
        patch = payload.model_dump(exclude_unset=True)
        patch["updatedAt"] = now_ms()
        jobs[index] = {**job, **patch}
        save_publish_jobs(jobs)
        return {"ok": True, "data": {"job": jobs[index]}}
    raise HTTPException(status_code=404, detail="Job not found")


@app.delete("/api/publish/jobs/{job_id}")
async def publish_jobs_delete(job_id: str) -> dict[str, Any]:
    jobs = [job for job in load_publish_jobs() if job["id"] != job_id]
    save_publish_jobs(jobs)
    return {"ok": True}


@app.get("/api/publish/queue/run")
async def publish_queue_run_get() -> dict[str, Any]:
    return {
        "ok": True,
        "data": {
            "route": "/api/publish/queue/run",
            "authRequired": False,
        },
    }


@app.post("/api/publish/queue/run")
async def publish_queue_run_post() -> dict[str, Any]:
    jobs = load_publish_jobs()
    target = next((job for job in jobs if job.get("status") == "queued"), None)
    if target is None:
        return {"ok": True, "data": {"processed": False, "message": "No queued jobs."}}

    target["status"] = "done"
    target["updatedAt"] = now_ms()
    target["resultText"] = "Processed by Python sidecar demo queue."
    target["results"] = [
        {
            "platform": platform,
            "ok": True,
            "mode": "manual",
        }
        for platform in target.get("platforms", [])
    ]
    save_publish_jobs(jobs)
    return {"ok": True, "data": {"processed": True, "job": target}}


@app.get("/api/publish/connector/health")
async def publish_connector_health() -> Response:
    url = f"{CONNECTOR_BASE_URL.rstrip('/')}/health"
    ok, status, text = await fetch_connector_text(url, 1800)
    if not ok:
        return JSONResponse(
            {"ok": False, "error": text or "Connector unavailable", "status": status, "url": url},
            status_code=502,
            headers={"Cache-Control": "no-store"},
        )
    try:
        health_payload: Any = json.loads(text)
    except Exception:
        health_payload = text
    return JSONResponse(
        {"ok": True, "url": url, "health": health_payload},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/publish/connector/jobs")
async def publish_connector_jobs(limit: str = "20") -> Response:
    url = f"{CONNECTOR_BASE_URL.rstrip('/')}/jobs?limit={quote(limit, safe='')}"
    ok, status, text = await fetch_connector_text(url, 2200)
    if not ok:
        return JSONResponse(
            {"ok": False, "error": text or "Connector unavailable", "status": status, "url": url},
            status_code=502,
            headers={"Cache-Control": "no-store"},
        )
    try:
        payload: Any = json.loads(text)
    except Exception:
        payload = text
    return JSONResponse(
        {"ok": True, "url": url, "data": payload},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/im-bridge/config")
async def im_bridge_config_get() -> Response:
    return JSONResponse(
        {"ok": True, "data": load_im_bridge_config()},
        headers={"Cache-Control": "no-store"},
    )


@app.put("/api/im-bridge/config")
async def im_bridge_config_put(payload: ImBridgeConfigPayload) -> Response:
    data = save_im_bridge_config(payload.model_dump())
    return JSONResponse(
        {"ok": True, "data": data},
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/im-bridge/health")
async def im_bridge_health() -> Response:
    return JSONResponse(
        {"ok": True, "data": get_im_bridge_health()},
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/im-bridge/test")
async def im_bridge_test(payload: ImBridgeTestPayload) -> Response:
    config = load_im_bridge_config()
    provider = (payload.provider or config.get("defaultProvider", "generic")).strip() or "generic"
    if provider not in {"generic", "feishu", "dingtalk"}:
        return JSONResponse({"ok": False, "error": "不支持的 provider"}, status_code=400)

    delivered = await deliver_im_reply_via_config(
        provider,
        config,
        "AgentCore OS 测试消息：移动端接入桥已联通。现在你可以从 IM 发送远程指令给桌面 Agent。",
    )
    append_im_bridge_event(
        {
            "provider": provider,
            "kind": "test",
            "status": "completed",
            "commandText": "发送测试消息",
            "requestText": "发送测试消息",
            "resultText": "AgentCore OS 测试消息：移动端接入桥已联通。",
            "resultPreview": "AgentCore OS 测试消息：移动端接入桥已联通。",
            "delivered": delivered,
                "error": "" if delivered else "主动回复未成功送达。",
                "retryable": True,
            }
        )
    return JSONResponse(
        {
            "ok": True,
            "data": {
                "provider": provider,
                "delivered": delivered,
                "text": "AgentCore OS 测试消息：移动端接入桥已联通。",
            },
        },
        headers={"Cache-Control": "no-store"},
    )


@app.get("/api/im-bridge/events")
async def im_bridge_events_get(limit: int = 20) -> Response:
    query = ImBridgeEventQuery(limit=limit)
    events = load_im_bridge_events()[: query.limit]
    return JSONResponse({"ok": True, "data": {"events": events}}, headers={"Cache-Control": "no-store"})


@app.delete("/api/im-bridge/events")
async def im_bridge_events_delete() -> Response:
    save_im_bridge_events([])
    return JSONResponse({"ok": True}, headers={"Cache-Control": "no-store"})


@app.post("/api/im-bridge/events/{event_id}/retry")
async def im_bridge_events_retry(event_id: str) -> Response:
    events = load_im_bridge_events()
    target = next((item for item in events if str(item.get("id") or "") == event_id), None)
    if target is None:
        return JSONResponse({"ok": False, "error": "记录不存在"}, status_code=404)
    if not target.get("retryable"):
        return JSONResponse({"ok": False, "error": "该记录当前不支持重试"}, status_code=400)

    provider = str(target.get("provider") or "generic").strip() or "generic"
    if provider not in {"generic", "feishu", "dingtalk"}:
        return JSONResponse({"ok": False, "error": "不支持的 provider"}, status_code=400)

    config = load_im_bridge_config()
    if not config.get("enabled"):
        return JSONResponse({"ok": False, "error": "IM Bridge 未启用"}, status_code=409)

    if target.get("kind") == "test":
        result_text = "AgentCore OS 测试消息：移动端接入桥已联通。现在你可以从 IM 发送远程指令给桌面 Agent。"
        delivered = await deliver_im_reply_via_config(provider, config, result_text)
        retry_event = append_im_bridge_event(
            {
                "provider": provider,
                "kind": "test",
                "status": "completed",
                "sessionId": str(target.get("sessionId") or "").strip(),
                "commandText": str(target.get("commandText") or "发送测试消息"),
                "requestText": str(target.get("requestText") or "发送测试消息"),
                "resultText": result_text,
                "resultPreview": build_im_event_preview(result_text),
                "delivered": delivered,
                "error": "" if delivered else "主动回复未成功送达。",
                "retryable": True,
                "sourceEventId": event_id,
            }
        )
        return JSONResponse(
            {"ok": True, "data": {"event": retry_event}},
            headers={"Cache-Control": "no-store"},
        )

    command_text = str(target.get("commandText") or target.get("requestText") or "").strip()
    session_id = str(target.get("sessionId") or "").strip() or f"im-{provider}-{uuid.uuid4().hex[:8]}"
    if not command_text:
        return JSONResponse({"ok": False, "error": "该记录缺少可重试的指令内容"}, status_code=400)

    execution = await execute_im_bridge_command(
        provider=provider,
        text=command_text,
        session_id=session_id,
        config=config,
    )
    retry_event = append_im_bridge_event(
        {
            "provider": provider,
            "kind": "inbound",
            "status": execution["status"],
            "sessionId": session_id,
            "commandText": command_text,
            "requestText": build_im_event_preview(command_text),
            "resultText": execution["text"],
            "resultPreview": build_im_event_preview(execution["text"]),
            "delivered": execution["delivered"],
            "error": execution["error"],
            "retryable": True,
            "sourceEventId": event_id,
        }
    )
    status_code = execution["statusCode"] if not execution["ok"] else 200
    body: dict[str, Any] = {"ok": execution["ok"], "data": {"event": retry_event}}
    if not execution["ok"]:
        body["error"] = execution["text"]
    return JSONResponse(body, status_code=status_code, headers={"Cache-Control": "no-store"})


@app.post("/api/im-bridge/inbound/{provider}")
async def im_bridge_inbound(provider: str, request: Request) -> Response:
    if provider not in {"generic", "feishu", "dingtalk"}:
        return JSONResponse({"ok": False, "error": "Unsupported provider"}, status_code=404)

    try:
        payload = (await request.json()) if request.headers.get("content-type", "").find("json") >= 0 else {}
    except Exception:
        payload = {}
    if not isinstance(payload, dict):
        payload = {}

    if provider == "feishu" and isinstance(payload.get("challenge"), str):
        return JSONResponse({"challenge": payload["challenge"]}, headers={"Cache-Control": "no-store"})

    config = load_im_bridge_config()
    if not authorize_im_bridge(request, config):
        append_im_bridge_event(
            {
                "provider": provider,
                "kind": "inbound",
                "status": "unauthorized",
                "commandText": extract_remote_text(provider, payload),
                "requestText": build_im_event_preview(extract_remote_text(provider, payload)),
                "resultText": "",
                "resultPreview": "",
                "delivered": False,
                "error": "Unauthorized",
                "retryable": False,
            }
        )
        return JSONResponse({"ok": False, "error": "Unauthorized"}, status_code=401)
    if provider == "feishu" and not authorize_feishu_request(payload, config):
        append_im_bridge_event(
            {
                "provider": provider,
                "kind": "inbound",
                "status": "unauthorized",
                "commandText": extract_remote_text(provider, payload),
                "requestText": build_im_event_preview(extract_remote_text(provider, payload)),
                "resultText": "",
                "resultPreview": "",
                "delivered": False,
                "error": "飞书 verification token 校验失败",
                "retryable": False,
            }
        )
        return JSONResponse({"ok": False, "error": "飞书 verification token 校验失败"}, status_code=401)
    if provider == "dingtalk" and not authorize_dingtalk_request(request, config):
        append_im_bridge_event(
            {
                "provider": provider,
                "kind": "inbound",
                "status": "unauthorized",
                "commandText": extract_remote_text(provider, payload),
                "requestText": build_im_event_preview(extract_remote_text(provider, payload)),
                "resultText": "",
                "resultPreview": "",
                "delivered": False,
                "error": "钉钉 sign 校验失败",
                "retryable": False,
            }
        )
        return JSONResponse({"ok": False, "error": "钉钉 sign 校验失败"}, status_code=401)
    if not config.get("enabled"):
        append_im_bridge_event(
            {
                "provider": provider,
                "kind": "inbound",
                "status": "disabled",
                "commandText": extract_remote_text(provider, payload),
                "requestText": build_im_event_preview(extract_remote_text(provider, payload)),
                "resultText": "",
                "resultPreview": "",
                "delivered": False,
                "error": "IM Bridge 未启用",
                "retryable": False,
            }
        )
        return JSONResponse({"ok": False, "error": "IM Bridge 未启用"}, status_code=409)

    text = extract_remote_text(provider, payload)
    command_prefix = str(config.get("commandPrefix", "") or "").strip()
    if command_prefix:
        if not text.startswith(command_prefix):
            append_im_bridge_event(
                {
                    "provider": provider,
                    "kind": "inbound",
                    "status": "ignored",
                    "commandText": text,
                    "requestText": build_im_event_preview(text),
                    "resultText": "",
                    "resultPreview": "",
                    "delivered": False,
                    "error": f"消息未匹配前缀 {command_prefix}",
                    "retryable": False,
                }
            )
            return JSONResponse(
                {
                    "ok": True,
                    "data": {
                        "ignored": True,
                        "reason": f"消息未匹配前缀 {command_prefix}",
                    },
                },
                headers={"Cache-Control": "no-store"},
            )
        text = text[len(command_prefix) :].strip()

    if not text:
        append_im_bridge_event(
            {
                "provider": provider,
                "kind": "inbound",
                "status": "invalid",
                "commandText": "",
                "requestText": "",
                "resultText": "",
                "resultPreview": "",
                "delivered": False,
                "error": "未解析到指令文本",
                "retryable": False,
            }
        )
        return JSONResponse({"ok": False, "error": "未解析到指令文本"}, status_code=400)

    session_id = extract_remote_session_id(provider, payload)
    execution = await execute_im_bridge_command(
        provider=provider,
        text=text,
        session_id=session_id,
        config=config,
        reply_payload=payload,
    )
    append_im_bridge_event(
        {
            "provider": provider,
            "kind": "inbound",
            "status": execution["status"],
            "sessionId": session_id,
            "commandText": text,
            "requestText": build_im_event_preview(text),
            "resultText": execution["text"],
            "resultPreview": build_im_event_preview(execution["text"]),
            "delivered": execution["delivered"],
            "error": execution["error"],
            "retryable": True,
        }
    )

    if not execution["ok"]:
        return JSONResponse({"ok": False, "error": execution["text"]}, status_code=execution["statusCode"])

    return JSONResponse(
        {
            "ok": True,
            "data": {
                "provider": provider,
                "sessionId": session_id,
                "text": execution["text"],
                "delivered": execution["delivered"],
            },
        },
        headers={"Cache-Control": "no-store"},
    )


@app.post("/api/llm/test")
async def llm_test(payload: LlmTestPayload) -> dict[str, Any]:
    if not payload.apiKey.strip():
        return {"ok": False, "error": "Missing API key"}
    if not payload.baseUrl.strip():
        return {"ok": False, "error": "Missing base URL"}
    if not payload.model.strip():
        return {"ok": False, "error": "Missing model"}
    return {"ok": True, "modelFound": True}


@app.post("/api/llm/chat")
async def llm_chat(payload: LlmChatPayload) -> Response:
    api_key = payload.apiKey.strip()
    base_url = normalize_base_url(payload.baseUrl)
    model = payload.model.strip()
    stream = payload.stream is not False
    messages = [
        {"role": item.role, "content": item.content}
        for item in payload.messages
        if item.role and item.content
    ]

    if not api_key:
        return JSONResponse({"ok": False, "error": "缺少 API Key"}, status_code=400)
    if not base_url:
        return JSONResponse({"ok": False, "error": "缺少 Base URL"}, status_code=400)
    if not model:
        return JSONResponse({"ok": False, "error": "缺少 Model"}, status_code=400)
    if not messages:
        return JSONResponse({"ok": False, "error": "缺少 messages"}, status_code=400)

    request_payload = {
        "model": model,
        "messages": messages,
        "stream": stream,
        "temperature": 0.7,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "text/event-stream" if stream else "application/json",
    }
    url = chat_completions_url(base_url)

    if stream:
        client = httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=20.0))
        upstream = await client.send(
            client.build_request("POST", url, headers=headers, json=request_payload),
            stream=True,
        )
        if not upstream.is_success:
            text = (await upstream.aread()).decode("utf-8", errors="ignore").strip()
            await upstream.aclose()
            await client.aclose()
            return JSONResponse(
                {"ok": False, "error": text or f"{upstream.status_code} {upstream.reason_phrase}"},
                status_code=502,
                headers={"Cache-Control": "no-store"},
            )

        return StreamingResponse(
            upstream.aiter_bytes(),
            status_code=200,
            media_type="text/event-stream; charset=utf-8",
            headers={
                "Cache-Control": "no-store",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
            background=BackgroundTask(close_stream_resources, upstream, client),
        )

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=20.0)) as client:
        upstream = await client.post(url, headers=headers, json=request_payload)
    if not upstream.is_success:
        return JSONResponse(
            {"ok": False, "error": upstream.text.strip() or f"{upstream.status_code} {upstream.reason_phrase}"},
            status_code=502,
            headers={"Cache-Control": "no-store"},
        )
    try:
        data: Any = upstream.json()
    except Exception:
        data = {"ok": True, "text": upstream.text}
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


@app.post("/api/openclaw/test")
async def openclaw_test(payload: OpenClawTestPayload) -> dict[str, Any]:
    if payload.baseUrl.strip():
        return {"ok": True, "endpoint": payload.baseUrl.strip()}
    return {"ok": True, "endpoint": "local-sidecar"}


@app.get("/api/openclaw/gateway/health")
async def openclaw_gateway_health() -> dict[str, Any]:
    return {
        "ok": True,
        "health": {
            "service": APP_NAME,
            "status": "ok",
            "upstreamConfigured": bool(os.getenv("LOBSTER_UPSTREAM_BASE_URL", "").strip()),
            "bridge": get_lobster_bridge_status(),
        },
    }


@app.post("/api/openclaw/agent")
async def openclaw_agent(payload: OpenClawAgentPayload) -> dict[str, Any]:
    if payload.llm is not None:
        save_last_llm_config(payload.llm)
    try:
        text = await call_lobster_text(
            message=payload.message,
            session_id=payload.sessionId,
            timeout_seconds=payload.timeoutSeconds or 30,
            llm_payload=payload.llm,
            system_prompt=payload.systemPrompt or "",
            use_lobster_skills=bool(payload.useLobsterSkills if payload.useLobsterSkills is not None else payload.useSkills),
            workspace_context=payload.workspaceContext or {},
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or exc.response.reason_phrase
        return {
            "ok": False,
            "error": f"模型接口调用失败（HTTP {exc.response.status_code}）：{detail[:400]}",
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
    return {"ok": True, "text": text or "（模型未返回文本）"}


@app.post("/api/openclaw/copy")
async def openclaw_copy(payload: OpenClawCopyPayload) -> Response:
    style = (payload.style or "xiaohongshu").strip() or "xiaohongshu"
    topic = (payload.topic or "").strip()
    if not topic:
        return JSONResponse({"ok": False, "error": "缺少输入内容"}, status_code=400)
    try:
        text = await call_lobster_text(
            message=build_copy_message(style, topic),
            session_id=f"desktop-copy-{style}",
            timeout_seconds=90,
            llm_payload=payload.llm,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or exc.response.reason_phrase
        return JSONResponse(
            {"ok": False, "error": f"模型接口调用失败（HTTP {exc.response.status_code}）：{detail[:400]}"},
            status_code=502,
        )
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)
    return JSONResponse({"ok": True, "text": text, "raw": text}, headers={"Cache-Control": "no-store"})


@app.post("/api/openclaw/vault/query")
async def openclaw_vault_query(payload: VaultQueryPayload) -> Response:
    query = (payload.query or "").strip()
    if not query:
        return JSONResponse({"ok": False, "error": "缺少 query"}, status_code=400)

    folder_name = (payload.folderName or "知识库").strip() or "知识库"
    files = payload.files or []
    try:
        text = await call_lobster_text(
            message=build_vault_message(query, folder_name, files),
            session_id="desktop-vault-query",
            timeout_seconds=60,
            llm_payload=payload.llm,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or exc.response.reason_phrase
        return JSONResponse(
            {"ok": False, "error": f"模型接口调用失败（HTTP {exc.response.status_code}）：{detail[:400]}"},
            status_code=502,
        )
    except Exception as exc:
        return JSONResponse({"ok": False, "error": str(exc)}, status_code=500)
    return JSONResponse({"ok": True, "text": text, "raw": text}, headers={"Cache-Control": "no-store"})


@app.get("/api/openclaw/assets/{name}")
async def openclaw_asset(name: str) -> Response:
    if not re.fullmatch(r"[\w.\-]+", name):
        return JSONResponse({"ok": False, "error": "非法文件名"}, status_code=400)
    file_path = outputs_root() / name
    if not file_path.exists() or not file_path.is_file():
        return JSONResponse({"ok": False, "error": "文件不存在"}, status_code=404)
    content_type = mimetypes.guess_type(name)[0] or "application/octet-stream"
    return Response(
        content=file_path.read_bytes(),
        media_type=content_type,
        headers={
            "Content-Length": str(file_path.stat().st_size),
            "Cache-Control": "no-store",
        },
    )


# ---------------------------------------------------------------------------
# /api/copy/generate – template-based copy generator (no LLM required)
# ---------------------------------------------------------------------------

class CopyGeneratePayload(BaseModel):
    style: str = "xiaohongshu"
    topic: str = ""


def _fnv1a(text: str) -> int:
    """FNV-1a hash (32-bit), matching the TypeScript seedFrom()."""
    h = 2166136261
    for ch in text:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def _pick(arr: list[str], seed: int) -> str:
    return arr[abs(seed) % len(arr)]


def _split_points(text: str) -> list[str]:
    raw = [s.strip() for s in re.split(r"[\n，,。.!！?？;；、]", text) if s.strip()]
    if not raw:
        t = text.strip()
        return [t] if t else []
    return raw[:6]


def _gen_xhs(topic: str) -> str:
    seed = _fnv1a(f"xhs:{topic}")
    points = _split_points(topic)
    hooks = ["我真的后悔没早点知道", "太离谱了…", "不允许还有人不知道", "今天必须安利"]
    titles = [
        f"🔥 {_pick(hooks, seed)}：{points[0] if points else topic}",
        f"💡 {points[0] if points else topic}｜一看就会的实用思路",
        f"✨ {points[0] if points else topic} 真实体验：值得吗？",
    ]
    emojis = ["✨", "💡", "🔥", "✅", "📌", "🧩", "🚀", "🫶"]
    selling = "\n".join(
        f"{_pick(emojis, seed + 10 + i)} 卖点 {i + 1}：{p}" for i, p in enumerate(points)
    )
    tag_word = (points[0] if points else "好物推荐")[:8]
    body = "\n".join([
        f"【标题】\n" + "\n".join(f"- {t}" for t in titles),
        "",
        f"【正文】\n{_pick(emojis, seed + 1)} 先说结论：{points[0] if points else topic}，真的很适合「想快速见效」的人。\n",
        selling,
        "",
        f"【怎么用/怎么选】\n{_pick(emojis, seed + 2)} 场景：___\n{_pick(emojis, seed + 3)} 人群：___\n{_pick(emojis, seed + 4)} 建议：先从 ___ 开始",
        "",
        f"【结尾】\n{_pick(emojis, seed + 5)} 想要我把它写成\u201c更狠\u201d的版本（更强钩子/更强转化）？把你的产品/受众/价格发我～",
        "",
        f"【标签】\n#干货分享 #内容运营 #文案 #增长 #{tag_word}",
    ])
    return body.strip()


def _gen_wechat(topic: str) -> str:
    seed = _fnv1a(f"wechat:{topic}")
    points = _split_points(topic)
    p0 = points[0] if points else topic
    title = f"关于「{p0}」的结构化分析与可执行建议"
    insights = "\n".join(f"- 洞察 {i + 1}：{p}" for i, p in enumerate(points[:3]))
    body = "\n".join([
        f"标题：{title}",
        "",
        "摘要：",
        f"- 核心问题：{p0} 为什么值得做/买/关注？",
        "- 关键结论：给出 3 条可落地建议与风险提示。",
        "",
        "正文：",
        "一、背景与痛点",
        f"- 现状：{topic}",
        "二、关键洞察（3 点）",
        insights,
        "三、解决方案与路径",
        f"- 路径 A：{_pick(['先做小样验证', '从一个细分场景切入', '用数据定义目标'], seed + 1)}",
        f"- 路径 B：{_pick(['建立内容资产库', '打造可复用模板', '沉淀 SOP'], seed + 2)}",
        f"- 路径 C：{_pick(['用最小成本试错', '控制变量迭代', '复盘并放大有效策略'], seed + 3)}",
        "四、风险与边界",
        f"- 风险 1：{_pick(['目标不清导致发散', '资源不足导致半途而废', '指标选择不当'], seed + 4)}",
        f"- 风险 2：{_pick(['缺少复盘机制', '忽视用户反馈', '节奏过快质量下滑'], seed + 5)}",
        "",
        "结论与行动建议：",
        "1) 用一句话明确目标（人群/场景/转化）。",
        "2) 先做 1 周小规模验证，再决定是否加码。",
        "3) 每次迭代只改一个变量，确保可复盘。",
    ])
    return body.strip()


def _gen_shortvideo(topic: str) -> str:
    seed = _fnv1a(f"shortvideo:{topic}")
    points = _split_points(topic)
    p0 = points[0] if points else topic
    hook = _pick(
        [
            f"3 秒告诉你：{p0} 到底怎么选？",
            f"别再踩坑了！{p0} 这样做立刻变好",
            f"我用 7 天验证：{p0} 真的有效吗？",
        ],
        seed,
    )
    script_lines = "\n".join(f"{i + 1}）{p}。" for i, p in enumerate(points[:3]))
    body = "\n".join([
        "【开场 3 秒钩子】",
        hook,
        "",
        "【镜头/画面】",
        "1) 近景：你指着问题点（字幕加粗）。",
        "2) 中景：展示对比/步骤（屏幕录制或实拍）。",
        "3) 结尾：成果展示 + CTA。",
        "",
        "【口播文案】",
        f"如果你也在纠结「{topic}」，先记住这 3 句：",
        script_lines,
        "",
        "【字幕要点】",
        f"- 重点 1：{points[0] if points else topic}",
        f"- 重点 2：{points[1] if len(points) > 1 else '怎么做更省时间'}",
        f"- 重点 3：{points[2] if len(points) > 2 else '怎么避免踩坑'}",
        "",
        "【结尾引导】",
        _pick(
            [
                "要模板/清单的评论区打「1」，我发你。",
                "想要我按你的产品改成\u201c更爆\u201d的脚本？私信我关键词。",
                "关注我，后面每天 1 条可直接抄作业的脚本。",
            ],
            seed + 7,
        ),
    ])
    return body.strip()


@app.post("/api/copy/generate")
async def copy_generate(payload: CopyGeneratePayload) -> Response:
    topic = (payload.topic or "").strip()
    if not topic:
        return JSONResponse({"ok": False, "error": "缺少输入内容"}, status_code=400)
    style = (payload.style or "xiaohongshu").strip()
    if style == "wechat":
        text = _gen_wechat(topic)
    elif style == "shortvideo":
        text = _gen_shortvideo(topic)
    else:
        text = _gen_xhs(topic)
    return JSONResponse({"ok": True, "text": text}, headers={"Cache-Control": "no-store"})


@app.post("/api/openclaw/execute")
async def openclaw_execute(request: Request) -> Response:
    content_type = request.headers.get("content-type", "")
    prompt = ""
    file_url = ""
    engine_url = ""
    token = ""

    try:
        if "multipart/form-data" in content_type:
            try:
                form = await request.form()
            except Exception as exc:
                message = str(exc)
                maybe_too_large = bool(re.search(r"too\s*large|payload|body|max|limit|size", message, flags=re.IGNORECASE))
                return JSONResponse(
                    {
                        "ok": False,
                        "error": (
                            "上传失败：视频文件过大或超出服务端请求体限制。请先用较小的视频测试，或改用可被引擎直接读取的 fileUrl 路径方案。"
                            if maybe_too_large
                            else f"请求异常（解析上传内容失败）：{message}"
                        ),
                    },
                    status_code=413 if maybe_too_large else 400,
                    headers={"Cache-Control": "no-store"},
                )
            prompt = str(form.get("prompt") or "").strip()
            file_url = str(form.get("fileUrl") or "").strip()
            engine_url = str(form.get("engineUrl") or "").strip()
            token = str(form.get("token") or "").strip()
            maybe_file = form.get("file")
            if isinstance(maybe_file, UploadFile) or (
                maybe_file is not None and hasattr(maybe_file, "read") and hasattr(maybe_file, "filename")
            ):
                file_url = await save_uploaded_file(maybe_file)
        else:
            body = ExecutePayload.model_validate(await request.json())
            prompt = (body.prompt or "").strip()
            file_url = (body.fileUrl or "").strip()
            engine_url = (body.engineUrl or "").strip()
            token = (body.token or "").strip()
    except Exception as exc:
        return JSONResponse(
            {"ok": False, "error": f"请求异常：{exc}"},
            status_code=500,
            headers={"Cache-Control": "no-store"},
        )

    header_engine_url = request.headers.get("x-openclaw-engine-url", "")
    header_token = request.headers.get("x-openclaw-token", "")
    if not engine_url and header_engine_url.strip():
        engine_url = header_engine_url.strip()
    if not token and header_token.strip():
        token = header_token.strip()
    engine_url = normalize_base_url(engine_url)

    if not prompt:
        return JSONResponse({"ok": False, "error": "缺少 prompt"}, status_code=400)
    if not file_url:
        return JSONResponse({"ok": False, "error": "缺少 fileUrl 或 file"}, status_code=400)

    if not engine_url:
        try:
            payload = await local_video_frames_execute(request=request, prompt=prompt, file_url=file_url)
            return JSONResponse(payload, headers={"Cache-Control": "no-store"})
        except Exception as exc:
            return JSONResponse(
                {"ok": False, "error": f"本地 video-frames 处理失败：{exc}"},
                status_code=500,
                headers={"Cache-Control": "no-store"},
            )

    try:
        status_code, text = await call_openclaw_chat(
            engine_url=engine_url,
            token=token,
            prompt=prompt,
            file_url=file_url,
        )
    except Exception as exc:
        try:
            payload = await local_video_frames_execute(request=request, prompt=prompt, file_url=file_url)
            return JSONResponse(payload, headers={"Cache-Control": "no-store"})
        except Exception as fallback_exc:
            return JSONResponse(
                {
                    "ok": False,
                    "error": f"无法连接到 OpenClaw 引擎，请检查 {engine_url} 是否运行；本地 video-frames 兜底也失败：{fallback_exc}（原始错误：{exc}）",
                },
                status_code=502,
                headers={"Cache-Control": "no-store"},
            )

    if status_code in {401, 403}:
        return JSONResponse(
            {"ok": False, "error": "鉴权失败：请在『设置 → 引擎核心』中填写正确的 OpenClaw API Token。"},
            status_code=502,
            headers={"Cache-Control": "no-store"},
        )
    if status_code in {404, 405}:
        try:
            payload = await local_video_frames_execute(request=request, prompt=prompt, file_url=file_url)
            return JSONResponse(payload, headers={"Cache-Control": "no-store"})
        except Exception as exc:
            return JSONResponse(
                {"ok": False, "error": f"本地 video-frames 兜底失败：{exc}"},
                status_code=502,
                headers={"Cache-Control": "no-store"},
            )
    if status_code < 200 or status_code >= 300:
        return JSONResponse(
            {"ok": False, "error": text or f"{status_code} upstream error"},
            status_code=502,
            headers={"Cache-Control": "no-store"},
        )

    parsed = extract_json_from_text(text)
    output = parse_output_from_unknown(parsed) or {"videoSrc": None, "coverSrc": None}
    if not output["coverSrc"] and isinstance(parsed, dict):
        cover_base64 = parsed.get("coverBase64") or parsed.get("cover_base64") or parsed.get("cover_image_base64")
        if isinstance(cover_base64, str):
            output["coverSrc"] = ensure_data_url_from_base64(cover_base64)

    return JSONResponse(
        {"ok": True, "output": output, "raw": parsed if parsed is not None else text},
        headers={"Cache-Control": "no-store"},
    )


if __name__ == "__main__":
    uvicorn.run(
        app,
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "8080")),
        log_level=os.getenv("LOG_LEVEL", "info").lower(),
    )
