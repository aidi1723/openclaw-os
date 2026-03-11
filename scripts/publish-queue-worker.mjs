const appUrl = (process.env.OPENCLAW_APP_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");
const intervalMs = Number.parseInt(process.env.OPENCLAW_QUEUE_INTERVAL_MS ?? "3000", 10);
const queueSecret = (process.env.OPENCLAW_QUEUE_SECRET ?? "").trim();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOnce() {
  const headers = { "Content-Type": "application/json" };
  if (queueSecret) {
    headers.Authorization = `Bearer ${queueSecret}`;
  }

  const res = await fetch(`${appUrl}/api/publish/queue/run`, {
    method: "POST",
    headers,
  });

  const data = await res.json().catch(() => null);
  const ts = new Date().toLocaleTimeString();

  if (!res.ok) {
    console.error(`[${ts}] queue error ${res.status}`, data?.error ?? "unknown");
    return;
  }

  if (data?.processed) {
    const status = data?.ok ? "done" : data?.retried ? "retry" : "error";
    const title = data?.job?.draftTitle ?? "(untitled)";
    console.log(`[${ts}] processed ${status}: ${title}`);
    return;
  }

  if (data?.skipped === "locked") {
    console.log(`[${ts}] skipped: queue locked`);
    return;
  }

  console.log(`[${ts}] idle`);
}

async function main() {
  console.log(`publish queue worker -> ${appUrl} every ${Number.isFinite(intervalMs) ? intervalMs : 3000}ms`);
  if (queueSecret) {
    console.log("queue auth: enabled");
  }

  while (true) {
    try {
      await runOnce();
    } catch (err) {
      console.error("worker exception", err instanceof Error ? err.message : err);
    }
    await sleep(Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : 3000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
