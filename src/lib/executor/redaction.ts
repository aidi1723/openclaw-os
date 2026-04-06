const NAMED_SECRET_PATTERN =
  /\b(api[_ -]?key|token|password|secret|authorization)\b(\s*[:=]\s*)([^\s,;"'\n]{6,})/gi;
const BEARER_PATTERN = /\b(Bearer\s+)([A-Za-z0-9._-]{8,})/g;
const OPENAI_KEY_PATTERN = /\bsk-(?:proj-)?[A-Za-z0-9_-]{6,}\b/g;
const ANTHROPIC_KEY_PATTERN = /\bsk-ant-[A-Za-z0-9_-]{6,}\b/g;

export function redactSensitiveText(value: string) {
  if (!value) return "";

  return value
    .replace(BEARER_PATTERN, "$1[REDACTED]")
    .replace(OPENAI_KEY_PATTERN, "[REDACTED-OPENAI-KEY]")
    .replace(ANTHROPIC_KEY_PATTERN, "[REDACTED-ANTHROPIC-KEY]")
    .replace(NAMED_SECRET_PATTERN, (_, label: string, separator: string) => {
      return `${label}${separator}[REDACTED]`;
    });
}
