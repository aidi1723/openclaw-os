function readSecret() {
  return (process.env.OPENCLAW_QUEUE_SECRET ?? "").trim();
}

export function isQueueSecretEnabled() {
  return Boolean(readSecret());
}

export function isAuthorizedQueueRequest(req: Request) {
  const secret = readSecret();
  if (!secret) return true;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const direct = (req.headers.get("x-openclaw-queue-secret") ?? "").trim();
  return bearer === secret || direct === secret;
}
