from __future__ import annotations

import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx


FRONTMATTER_RE = re.compile(r"^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?")
TOKEN_RE = re.compile(r"[a-z0-9][a-z0-9_-]{1,}")
LIVE_INFO_HINT_RE = re.compile(
    r"\b(latest|today|current|news|recent)\b|实时|最新|今天|近期",
    re.IGNORECASE,
)
PLAN_HINT_RE = re.compile(r"\b(plan|roadmap)\b|方案|计划|执行方案|步骤", re.IGNORECASE)
RESEARCH_HINT_RE = re.compile(
    r"\b(research|investigate|docs|documentation)\b|调研|研究|文档|资料",
    re.IGNORECASE,
)
WEB_FRAMEWORK_HINT_RE = re.compile(
    r"\b(next\.?js|react|vue|angular|svelte|nuxt|frontend)\b|前端",
    re.IGNORECASE,
)
EMAIL_HINT_RE = re.compile(r"\b(email|mail)\b|邮件|邮箱", re.IGNORECASE)
SCHEDULE_HINT_RE = re.compile(r"\b(schedule|calendar|meeting)\b|日程|日历|会议", re.IGNORECASE)
VIDEO_HINT_RE = re.compile(r"\b(video|remotion)\b|剪辑|视频|短片", re.IGNORECASE)
GAME_HINT_RE = re.compile(r"\b(game|web game)\b|小游戏", re.IGNORECASE)
COMMON_NOISE_TOKENS = {
    "with",
    "from",
    "that",
    "this",
    "when",
    "then",
    "into",
    "your",
    "have",
    "will",
    "agent",
    "using",
    "used",
    "needs",
    "need",
    "task",
    "work",
    "skill",
}


@dataclass
class LobsterSkill:
    id: str
    name: str
    description: str
    enabled: bool
    order: int
    skill_path: str


@dataclass
class LobsterLlmConfig:
    provider: str
    api_key: str
    base_url: str
    model: str


@dataclass
class LobsterAgentRequest:
    message: str
    session_id: str
    timeout_seconds: int
    llm: LobsterLlmConfig
    system_prompt: str
    use_lobster_skills: bool
    workspace_context: dict[str, Any]


def lobster_src_root() -> Path:
    candidates: list[Path] = []

    raw = os.getenv("LOBSTER_SRC_ROOT", "").strip()
    if raw:
        candidates.append(Path(raw).expanduser())

    meipass = getattr(sys, "_MEIPASS", "")
    if meipass:
        candidates.append(Path(meipass) / "lobster-src")

    current = Path.cwd()
    candidates.extend(
        [
            current / "lobster-src",
            current.parent / "lobster-src",
            Path(__file__).resolve().parent.parent / "lobster-src",
        ]
    )

    for candidate in candidates:
        resolved = candidate.resolve()
        if (resolved / "SKILLs").exists():
            return resolved

    return candidates[0].resolve() if candidates else (current / "lobster-src").resolve()


def skills_root() -> Path:
    return lobster_src_root() / "SKILLs"


def parse_frontmatter(raw: str) -> tuple[dict[str, str], str]:
    normalized = raw.lstrip("\ufeff")
    match = FRONTMATTER_RE.match(normalized)
    if not match:
        return {}, normalized

    block = match.group(1)
    result: dict[str, str] = {}
    for line in block.splitlines():
        if not line or line[:1].isspace() or ":" not in line:
            continue
        key, value = line.split(":", 1)
        result[key.strip()] = value.strip().strip("'\"")
    return result, normalized[match.end() :]


def load_skill_defaults() -> dict[str, dict[str, Any]]:
    config_path = skills_root() / "skills.config.json"
    if not config_path.exists():
        return {}
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    defaults = payload.get("defaults")
    return defaults if isinstance(defaults, dict) else {}


def load_lobster_skills() -> list[LobsterSkill]:
    root = skills_root()
    if not root.exists():
        return []

    defaults = load_skill_defaults()
    skills: list[LobsterSkill] = []
    for skill_md in sorted(root.glob("*/SKILL.md")):
        skill_id = skill_md.parent.name
        raw = skill_md.read_text(encoding="utf-8")
        frontmatter, content = parse_frontmatter(raw)
        defaults_item = defaults.get(skill_id, {})
        enabled = bool(defaults_item.get("enabled", True))
        order = int(defaults_item.get("order", 999))
        name = frontmatter.get("name", skill_id).strip() or skill_id
        description = frontmatter.get("description", "").strip()
        if not description:
            first_line = next((line.strip() for line in content.splitlines() if line.strip()), "")
            description = first_line or f"Skill {skill_id}"
        skills.append(
            LobsterSkill(
                id=skill_id,
                name=name,
                description=description,
                enabled=enabled,
                order=order,
                skill_path=str(skill_md.resolve()),
            )
        )

    skills.sort(key=lambda item: (item.order, item.name.lower()))
    return skills


def count_enabled_skills() -> int:
    return len([skill for skill in load_lobster_skills() if skill.enabled])


def build_lobster_skills_prompt() -> str | None:
    enabled = [skill for skill in load_lobster_skills() if skill.enabled]
    if not enabled:
        return None

    skill_entries = "\n".join(
        (
            f"  <skill><id>{skill.id}</id><name>{skill.name}</name>"
            f"<description>{skill.description}</description>"
            f"<location>{skill.skill_path}</location></skill>"
        )
        for skill in enabled
    )
    return "\n".join(
        [
            "## AgentCore Skills Catalog",
            "Use <available_skills> as the canonical catalog of AgentCore OS capabilities.",
            "Select the most relevant skill mentally before answering.",
            "Do not claim that shell scripts, browsers, calendars, or local tools were actually executed unless concrete tool output is provided.",
            "If a request would normally require a live skill run, still produce the best immediate deliverable: a draft, action plan, checklist, summary, or operator guidance.",
            "If the user clearly asks for current information, say that a live AgentCore skill run is the correct next step.",
            "",
            "<available_skills>",
            skill_entries,
            "</available_skills>",
        ]
    )


def get_enabled_lobster_skills() -> list[LobsterSkill]:
    return [skill for skill in load_lobster_skills() if skill.enabled]


def recommend_lobster_skill(message: str, skills: list[LobsterSkill]) -> LobsterSkill | None:
    normalized_message = message.lower()
    tokens = {
        token
        for token in TOKEN_RE.findall(normalized_message)
        if token not in COMMON_NOISE_TOKENS and len(token) > 2
    }
    best_skill: LobsterSkill | None = None
    best_score = 0

    for skill in skills:
        name_tokens = {
            token
            for token in TOKEN_RE.findall(f"{skill.id} {skill.name}".lower())
            if token not in COMMON_NOISE_TOKENS
        }
        score = sum(4 for token in tokens if token in name_tokens)

        if skill.id in normalized_message:
            score += 5
        if LIVE_INFO_HINT_RE.search(message) and skill.id == "web-search":
            score += 35
        if RESEARCH_HINT_RE.search(message) and skill.id == "web-search":
            score += 20
        if WEB_FRAMEWORK_HINT_RE.search(message) and skill.id == "web-search":
            score += 20
        if PLAN_HINT_RE.search(message) and skill.id == "create-plan":
            score += 25
        if EMAIL_HINT_RE.search(message) and skill.id == "imap-smtp-email":
            score += 25
        if SCHEDULE_HINT_RE.search(message) and skill.id in {"local-tools", "scheduled-task"}:
            score += 18
        if VIDEO_HINT_RE.search(message) and skill.id in {"remotion", "seedance"}:
            score += 22
        if GAME_HINT_RE.search(message) and skill.id == "develop-web-game":
            score += 30
        if score > best_score:
            best_score = score
            best_skill = skill

    return best_skill if best_score > 0 else None


def should_enable_live_web_search(
    config: LobsterLlmConfig,
    selected_skill: LobsterSkill | None,
) -> bool:
    if selected_skill is None or selected_skill.id != "web-search":
        return False

    provider = detect_provider(config)
    if provider == "anthropic":
        return True

    return provider == "openai" and should_use_openai_responses_api(config)


def detect_provider(config: LobsterLlmConfig) -> str:
    provider = config.provider.strip().lower()
    if provider == "anthropic":
        return "anthropic"
    if "anthropic" in config.base_url.lower():
        return "anthropic"
    if config.model.lower().startswith("claude"):
        return "anthropic"
    return "openai"


def build_openai_compatible_chat_completions_url(config: LobsterLlmConfig) -> str:
    normalized = config.base_url.rstrip("/")
    if not normalized:
        return "/v1/chat/completions"
    if normalized.endswith("/chat/completions"):
        return normalized

    is_gemini_like = (
        config.provider.lower() == "gemini"
        or config.model.lower().startswith("gemini")
        or "generativelanguage.googleapis.com" in normalized
    )
    if is_gemini_like:
        if normalized.endswith("/v1beta/openai") or normalized.endswith("/v1/openai"):
            return f"{normalized}/chat/completions"
        if normalized.endswith("/v1beta") or normalized.endswith("/v1"):
            beta_base = f"{normalized[:-3]}v1beta" if normalized.endswith("/v1") else normalized
            return f"{beta_base}/openai/chat/completions"
        return f"{normalized}/v1beta/openai/chat/completions"

    if normalized.endswith("/v1"):
        return f"{normalized}/chat/completions"
    return f"{normalized}/v1/chat/completions"


def build_openai_responses_url(config: LobsterLlmConfig) -> str:
    normalized = config.base_url.rstrip("/")
    if not normalized:
        return "/v1/responses"
    if normalized.endswith("/responses"):
        return normalized
    if normalized.endswith("/v1"):
        return f"{normalized}/responses"
    return f"{normalized}/v1/responses"


def should_use_openai_responses_api(config: LobsterLlmConfig) -> bool:
    return config.provider.strip().lower() == "openai"


def should_use_max_completion_tokens(config: LobsterLlmConfig) -> bool:
    if config.provider.strip().lower() != "openai":
        return False
    normalized = config.model.strip().lower()
    resolved = normalized.rsplit("/", 1)[-1]
    return resolved.startswith(("gpt-5", "o1", "o3", "o4"))


def extract_openai_responses_text(payload: dict[str, Any]) -> str:
    text = payload.get("output_text")
    if isinstance(text, str) and text.strip():
        return text.strip()

    collected: list[str] = []
    for item in payload.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            if content.get("type") in {"output_text", "text"} and isinstance(content.get("text"), str):
                collected.append(content["text"])
    if collected:
        return "\n".join(part.strip() for part in collected if part and part.strip()).strip()

    choices = payload.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
    return ""


def build_agent_system_prompt(
    request: LobsterAgentRequest,
    selected_skill: LobsterSkill | None = None,
    live_web_search_enabled: bool = False,
) -> str:
    parts: list[str] = []
    if request.system_prompt.strip():
        parts.append(request.system_prompt.strip())

    parts.append(
        "You are AgentCore OS, an API-first business solution operating system. "
        "Respond with concrete, useful outputs optimized for business execution."
    )

    workspace_context = request.workspace_context or {}
    if workspace_context:
        parts.append(
            "Workspace context: "
            + ", ".join(
                f"{key}={value}"
                for key, value in workspace_context.items()
                if isinstance(value, (str, int, float)) and str(value).strip()
            )
        )

    if request.use_lobster_skills:
        skills = get_enabled_lobster_skills()
        skills_prompt = build_lobster_skills_prompt()
        if selected_skill is not None:
            parts.append(
                "Recommended AgentCore skill for this request: "
                f"{selected_skill.id} ({selected_skill.description}). "
                "Align the output to that skill's operating style."
            )
        if live_web_search_enabled:
            parts.append(
                "Live web search is enabled for this request. "
                "Use current web results when needed, cite concrete dates when answering time-sensitive questions, "
                "and clearly separate verified findings from inference."
            )
        if skills_prompt:
            parts.append(skills_prompt)

    return "\n\n".join(part for part in parts if part.strip())


async def call_anthropic_api(
    config: LobsterLlmConfig,
    user_message: str,
    system_prompt: str,
    timeout_seconds: int,
    enable_web_search: bool = False,
) -> str:
    url = f"{config.base_url.rstrip('/')}/v1/messages"
    payload: dict[str, Any] = {
        "model": config.model or "claude-3-5-sonnet-20241022",
        "max_tokens": 4096,
        "messages": [{"role": "user", "content": user_message}],
    }
    if system_prompt.strip():
        payload["system"] = system_prompt
    if enable_web_search:
        payload["tools"] = [
            {
                "type": "web_search_20250305",
                "name": "web_search",
                "max_uses": 5,
            }
        ]

    headers = {
        "x-api-key": config.api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
    }

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            should_retry_without_tools = (
                enable_web_search and exc.response.status_code in {400, 404, 422}
            )
            if not should_retry_without_tools:
                raise
            payload.pop("tools", None)
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        data = response.json()

    content = data.get("content")
    if isinstance(content, list):
        parts = [
            block.get("text", "")
            for block in content
            if isinstance(block, dict) and block.get("type") == "text"
        ]
        return "\n".join(part for part in parts if part).strip()
    if isinstance(content, dict):
        return str(content.get("text", "")).strip()
    return str(content or "").strip()


async def call_openai_compatible_api(
    config: LobsterLlmConfig,
    user_message: str,
    system_prompt: str,
    timeout_seconds: int,
    enable_web_search: bool = False,
) -> str:
    use_responses_api = should_use_openai_responses_api(config)
    url = (
        build_openai_responses_url(config)
        if use_responses_api
        else build_openai_compatible_chat_completions_url(config)
    )

    messages: list[dict[str, str]] = []
    if system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": user_message})

    if use_responses_api:
        payload: dict[str, Any] = {
            "model": config.model or "gpt-4o-mini",
            "input": [{"role": "user", "content": [{"type": "input_text", "text": user_message}]}],
            "max_output_tokens": 4096,
        }
        if system_prompt.strip():
            payload["instructions"] = system_prompt
        if enable_web_search:
            payload["tools"] = [{"type": "web_search"}]
            payload["tool_choice"] = "auto"
    else:
        payload = {
            "model": config.model or "gpt-4o-mini",
            "messages": messages,
        }
        if should_use_max_completion_tokens(config):
            payload["max_completion_tokens"] = 4096
        else:
            payload["max_tokens"] = 4096

    headers = {"content-type": "application/json"}
    if config.api_key:
        headers["authorization"] = f"Bearer {config.api_key}"

    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        try:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            should_retry_without_tools = (
                enable_web_search and use_responses_api and exc.response.status_code in {400, 404, 422}
            )
            if not should_retry_without_tools:
                raise
            payload.pop("tools", None)
            payload.pop("tool_choice", None)
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        data = response.json()

    if use_responses_api:
        return extract_openai_responses_text(data)

    choices = data.get("choices")
    if isinstance(choices, list) and choices:
        message = choices[0].get("message", {})
        content = message.get("content")
        if isinstance(content, str):
            return content.strip()
        if isinstance(content, list):
            parts = [
                item.get("text", "")
                for item in content
                if isinstance(item, dict) and isinstance(item.get("text"), str)
            ]
            return "\n".join(part for part in parts if part).strip()
    return ""


async def run_lobster_agent(request: LobsterAgentRequest) -> str:
    provider = detect_provider(request.llm)
    selected_skill = None
    if request.use_lobster_skills:
        selected_skill = recommend_lobster_skill(request.message, get_enabled_lobster_skills())
    enable_web_search = should_enable_live_web_search(request.llm, selected_skill)
    system_prompt = build_agent_system_prompt(
        request,
        selected_skill=selected_skill,
        live_web_search_enabled=enable_web_search,
    )
    timeout_seconds = max(5, min(600, request.timeout_seconds))

    if provider == "anthropic":
        return await call_anthropic_api(
            request.llm,
            request.message,
            system_prompt,
            timeout_seconds,
            enable_web_search=enable_web_search,
        )

    return await call_openai_compatible_api(
        request.llm,
        request.message,
        system_prompt,
        timeout_seconds,
        enable_web_search=enable_web_search,
    )
