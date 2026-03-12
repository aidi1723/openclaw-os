import { createServer } from "node:http";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(THIS_DIR, "..", "..");
const SIDECAR_ROOT = path.join(PROJECT_ROOT, "lobster-sidecar");

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

async function isExecutable(candidate) {
  try {
    await access(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveSidecarPython() {
  const candidates = [
    process.env.PYTHON_BIN,
    path.join(SIDECAR_ROOT, ".venv", "Scripts", "python.exe"),
    path.join(SIDECAR_ROOT, ".venv", "bin", "python3"),
    path.join(SIDECAR_ROOT, ".venv", "bin", "python"),
    process.platform === "win32" ? "python.exe" : "python3",
    "python",
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if ((await isExecutable(candidate)) || !candidate.includes(path.sep)) {
      return candidate;
    }
  }

  return null;
}

function hasCommand(command) {
  const versionArg = command === "ffmpeg" ? "-version" : "--version";
  const result = spawnSync(command, [versionArg], {
    cwd: PROJECT_ROOT,
    stdio: "ignore",
  });
  return result.status === 0;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate port.")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

async function waitForUrl(url, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function startMockLlmServer(port) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);

    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    if (req.method !== "POST" || !["/v1/chat/completions", "/v1/responses"].includes(url.pathname)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
    }

    const payload = body ? JSON.parse(body) : {};
    const messages = Array.isArray(payload.messages) ? payload.messages : [];
    const responsesInput = Array.isArray(payload.input) ? payload.input : [];
    const responsesLastInput = responsesInput.at(-1);
    const responsesContent = Array.isArray(responsesLastInput?.content)
      ? responsesLastInput.content
          .map((item) => (item && typeof item === "object" ? String(item.text || "") : ""))
          .join("\n")
      : "";
    const lastContent = String(messages.at(-1)?.content || responsesContent || "");

    let content = "AgentCore smoke test response.";
    if (lastContent.includes("视频处理参数解析器")) {
      content = '{"coverTime":"00:00:01","clipStartSeconds":0,"clipSeconds":1}';
    } else if (lastContent.includes("知识库检索助手")) {
      content = "【最相关文件】\n- sample.pdf\n【建议】\n- 粘贴关键段落";
    } else if (lastContent.includes("生成可直接发布的文案")) {
      content = "标题：测试文案\n正文：这是联调生成内容。";
    } else if (lastContent.includes("smoke agent")) {
      content = "Smoke agent executed.";
    }

    if (payload.stream) {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    if (url.pathname === "/v1/responses") {
      res.end(
        JSON.stringify({
          id: "resp-smoke",
          object: "response",
          output_text: content,
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: content }],
            },
          ],
        }),
      );
      return;
    }

    res.end(
      JSON.stringify({
        id: "chatcmpl-smoke",
        object: "chat.completion",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
          },
        ],
      }),
    );
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function startMockConnectorServer(port) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    if (req.method === "GET" && url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "mock-connector" }));
      return;
    }
    if (req.method === "GET" && url.pathname === "/jobs") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ jobs: [{ id: "job-1", status: "queued" }] }));
      return;
    }
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function startReplyWebhookServer(port, receipts) {
  const server = createServer(async (req, res) => {
    if (req.method !== "POST") {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
      return;
    }

    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
    }

    try {
      receipts.push({
        path: req.url || "/",
        payload: body ? JSON.parse(body) : null,
      });
    } catch {
      receipts.push({
        path: req.url || "/",
        payload: body,
      });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function startMockFeishuOfficialApiServer(port, receipts) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
    }
    const payload = body ? JSON.parse(body) : {};

    if (req.method === "POST" && url.pathname === "/open-apis/auth/v3/tenant_access_token/internal") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tenant_access_token: "feishu-token" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/open-apis/im/v1/messages") {
      receipts.push({
        path: url.pathname,
        query: Object.fromEntries(url.searchParams.entries()),
        payload,
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: 0, msg: "ok" }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function startMockDingTalkOfficialApiServer(port, receipts) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    let body = "";
    for await (const chunk of req) {
      body += String(chunk);
    }
    const payload = body ? JSON.parse(body) : {};

    if (req.method === "POST" && url.pathname === "/v1.0/oauth2/accessToken") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ accessToken: "dingtalk-token" }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1.0/robot/groupMessages/send") {
      receipts.push({
        path: url.pathname,
        payload,
        token: req.headers["x-acs-dingtalk-access-token"] || "",
      });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: "Not found" }));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

function startSidecar(pythonBinary, port, connectorPort, dataDir) {
  const child = spawn(
    pythonBinary,
    ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(port)],
    {
      cwd: SIDECAR_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        AGENTCORE_HEARTBEAT_TIMEOUT_SECONDS: "120",
        AGENTCORE_PUBLISH_CONNECTOR_URL: `http://127.0.0.1:${connectorPort}`,
        AGENTCORE_SIDECAR_DATA_DIR: dataDir,
      },
    },
  );

  child.stdout.on("data", (chunk) => process.stdout.write(String(chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(String(chunk)));
  return child;
}

async function stopProcess(child) {
  if (!child || child.killed) return;
  child.kill();
  const done = once(child, "exit").catch(() => null);
  await Promise.race([
    done,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
  if (child.exitCode == null && child.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      return;
    }
    child.kill("SIGKILL");
  }
}

async function createSampleVideo(tempDir) {
  const videoPath = path.join(tempDir, "sample.mp4");
  await new Promise((resolve, reject) => {
    const child = spawn(
      "ffmpeg",
      [
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=320x240:d=2",
        "-pix_fmt",
        "yuv420p",
        videoPath,
      ],
      {
        cwd: PROJECT_ROOT,
        stdio: ["ignore", "ignore", "pipe"],
      },
    );
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr || `ffmpeg exited with code ${code ?? 1}`));
    });
  });
  return videoPath;
}

async function main() {
  const pythonBinary = await resolveSidecarPython();
  if (!pythonBinary) {
    fail("Missing sidecar Python runtime. Create lobster-sidecar/.venv first, or set PYTHON_BIN.");
  }

  const llmPort = await findFreePort();
  const connectorPort = await findFreePort();
  const replyPort = await findFreePort();
  const feishuApiPort = await findFreePort();
  const dingtalkApiPort = await findFreePort();
  const sidecarPort = await findFreePort();
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "agentcore-smoke-"));
  const replyReceipts = [];
  const feishuApiReceipts = [];
  const dingtalkApiReceipts = [];

  const llmServer = await startMockLlmServer(llmPort);
  const connectorServer = await startMockConnectorServer(connectorPort);
  const replyServer = await startReplyWebhookServer(replyPort, replyReceipts);
  const feishuApiServer = await startMockFeishuOfficialApiServer(feishuApiPort, feishuApiReceipts);
  const dingtalkApiServer = await startMockDingTalkOfficialApiServer(dingtalkApiPort, dingtalkApiReceipts);
  const sidecar = startSidecar(pythonBinary, sidecarPort, connectorPort, path.join(tempDir, "sidecar-data"));

  try {
    await waitForUrl(`http://127.0.0.1:${sidecarPort}/health`);

    const llm = {
      provider: "openai",
      apiKey: "smoke-key",
      baseUrl: `http://127.0.0.1:${llmPort}`,
      model: "smoke-model",
    };

    const health = await fetch(`http://127.0.0.1:${sidecarPort}/health`).then((res) => res.json());
    assert(health.status === "ok", "Health check failed.");

    const contract = await fetch(`http://127.0.0.1:${sidecarPort}/_agentcore/runtime-contract`).then((res) =>
      res.json(),
    );
    assert(contract.status === "ok", "Runtime contract failed.");

    const runtimeDoctor = await fetchJson(`http://127.0.0.1:${sidecarPort}/api/runtime/doctor`);
    assert(runtimeDoctor.ok === true, "Runtime doctor route failed.");
    assert(runtimeDoctor.data?.report?.runtimeMode === "api_only", "Runtime doctor payload invalid.");
    assert(
      runtimeDoctor.data?.report?.checks?.localStore?.ok === true,
      "Runtime doctor should report a writable local store.",
    );
    assert(
      typeof runtimeDoctor.data?.report?.readiness?.desktopLightReady === "boolean",
      "Runtime doctor readiness payload invalid.",
    );
    assert(
      typeof runtimeDoctor.data?.report?.readiness?.creativeStudioReady === "boolean",
      "Runtime doctor creative studio readiness payload invalid.",
    );

    const desktopSettingsPayload = {
      llm: {
        activeProvider: "openai",
        providers: {
          openai: { apiKey: "smoke-key", baseUrl: "http://127.0.0.1:1234", model: "gpt-4o-mini" },
        },
      },
      runtime: {
        shell: "tauri",
        profile: "desktop_light",
      },
      personalization: {
        interfaceLanguage: "zh-CN",
      },
    };
    const desktopSettingsSave = await fetchJson(`http://127.0.0.1:${sidecarPort}/api/desktop/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(desktopSettingsPayload),
    });
    assert(desktopSettingsSave.ok === true, "Desktop settings save failed.");
    const desktopSettingsRead = await fetchJson(`http://127.0.0.1:${sidecarPort}/api/desktop/settings`);
    assert(desktopSettingsRead.ok === true, "Desktop settings load failed.");
    assert(
      desktopSettingsRead.data?.data?.settings?.llm?.activeProvider === "openai",
      "Desktop settings payload invalid.",
    );

    const runtimeSync = await fetchJson(`http://127.0.0.1:${sidecarPort}/api/runtime/sidecar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "sync",
        config: {
          profile: "desktop_dify",
          orchestration: "docker_compose",
          composeProjectName: "agentcore-runtime-smoke",
          localAppUrl: "http://127.0.0.1:3000",
          localRuntimeUrl: "http://127.0.0.1:18789",
          sidecarApiUrl: `http://127.0.0.1:${sidecarPort}`,
          difyBaseUrl: "http://127.0.0.1:5001",
          autoBootLocalStack: false,
        },
      }),
    });
    assert(runtimeSync.ok === true, "Runtime sidecar sync failed.");
    assert(runtimeSync.data?.status?.synced === true, "Runtime sidecar sync state invalid.");
    assert(
      runtimeSync.data?.status?.config?.composeProjectName === "agentcore-runtime-smoke",
      "Runtime sidecar config was not persisted.",
    );

    const runtimeBoot = await fetchJson(`http://127.0.0.1:${sidecarPort}/api/runtime/sidecar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "boot" }),
    });
    if (runtimeBoot.ok) {
      assert(runtimeBoot.data?.status?.lastAction?.ok === true, "Runtime boot success payload invalid.");
    } else {
      assert(runtimeBoot.status === 400, "Runtime boot should return HTTP 400 on failure.");
      assert(
        typeof runtimeBoot.data?.error === "string" && runtimeBoot.data.error.length > 0,
        "Runtime boot failure should include an actionable error.",
      );
    }

    const runtimeStop = await fetchJson(`http://127.0.0.1:${sidecarPort}/api/runtime/sidecar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "stop" }),
    });
    if (runtimeStop.ok) {
      assert(runtimeStop.data?.status?.lastAction?.ok === true, "Runtime stop success payload invalid.");
    } else {
      assert(runtimeStop.status === 400, "Runtime stop should return HTTP 400 on failure.");
      assert(
        typeof runtimeStop.data?.error === "string" && runtimeStop.data.error.length > 0,
        "Runtime stop failure should include an actionable error.",
      );
    }

    const llmChat = await fetch(`http://127.0.0.1:${sidecarPort}/api/llm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...llm,
        stream: false,
        messages: [{ role: "user", content: "hello smoke" }],
      }),
    }).then((res) => res.json());
    assert(llmChat.choices?.[0]?.message?.content, "LLM chat route failed.");

    const agent = await fetch(`http://127.0.0.1:${sidecarPort}/api/openclaw/agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "smoke agent",
        sessionId: "smoke-agent",
        llm,
      }),
    }).then((res) => res.json());
    assert(agent.ok === true, "OpenClaw agent route failed.");

    const copy = await fetch(`http://127.0.0.1:${sidecarPort}/api/openclaw/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        style: "xiaohongshu",
        topic: "联调测试",
        llm,
      }),
    }).then((res) => res.json());
    assert(copy.ok === true && String(copy.text || "").includes("标题"), "Copy route failed.");

    const vault = await fetch(`http://127.0.0.1:${sidecarPort}/api/openclaw/vault/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "帮我找资料",
        folderName: "产品资料库",
        files: [{ name: "sample.pdf", size: 2048 }],
        llm,
      }),
    }).then((res) => res.json());
    assert(vault.ok === true && String(vault.text || "").includes("最相关文件"), "Vault route failed.");

    const connectorHealth = await fetch(
      `http://127.0.0.1:${sidecarPort}/api/publish/connector/health`,
    ).then((res) => res.json());
    assert(connectorHealth.ok === true, "Publish connector health failed.");

    const connectorJobs = await fetch(
      `http://127.0.0.1:${sidecarPort}/api/publish/connector/jobs?limit=2`,
    ).then((res) => res.json());
    assert(Array.isArray(connectorJobs.data?.jobs), "Publish connector jobs failed.");

    const bridgeConfig = await fetch(`http://127.0.0.1:${sidecarPort}/api/im-bridge/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enabled: true,
        publicBaseUrl: "https://agentcore.example.com",
        accessToken: "bridge-token",
        defaultProvider: "generic",
        autoReply: true,
        commandPrefix: "/agent",
        providers: {
          generic: {
            replyMode: "webhook",
            replyWebhookUrl: `http://127.0.0.1:${replyPort}/generic`,
            verificationToken: "",
            signingSecret: "",
            officialApiBaseUrl: "",
            officialAppId: "",
            officialAppSecret: "",
            officialTargetId: "",
            officialTargetIdType: "",
            officialRobotCode: "",
            officialConversationId: "",
          },
          feishu: {
            replyMode: "official_api",
            replyWebhookUrl: `http://127.0.0.1:${replyPort}/feishu`,
            verificationToken: "feishu-verify-token",
            signingSecret: "",
            officialApiBaseUrl: `http://127.0.0.1:${feishuApiPort}`,
            officialAppId: "cli_feishu_smoke",
            officialAppSecret: "feishu_secret_smoke",
            officialTargetId: "oc-fixed-chat",
            officialTargetIdType: "chat_id",
            officialRobotCode: "",
            officialConversationId: "",
          },
          dingtalk: {
            replyMode: "official_api",
            replyWebhookUrl: `http://127.0.0.1:${replyPort}/dingtalk`,
            verificationToken: "",
            signingSecret: "ding-sign-secret",
            officialApiBaseUrl: `http://127.0.0.1:${dingtalkApiPort}`,
            officialAppId: "ding_app_key",
            officialAppSecret: "ding_app_secret",
            officialTargetId: "",
            officialTargetIdType: "",
            officialRobotCode: "ding_robot_code",
            officialConversationId: "cid-fixed-conversation",
          },
        },
      }),
    }).then((res) => res.json());
    assert(bridgeConfig.ok === true, "IM bridge config save failed.");

    const bridgeHealth = await fetch(`http://127.0.0.1:${sidecarPort}/api/im-bridge/health`).then((res) =>
      res.json(),
    );
    assert(bridgeHealth.ok === true, "IM bridge health failed.");
    assert(
      String(bridgeHealth.data?.callbackUrls?.generic || "").includes("/api/im-bridge/inbound/generic"),
      "IM bridge callback URL missing.",
    );

    const bridgeTest = await fetch(`http://127.0.0.1:${sidecarPort}/api/im-bridge/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "generic" }),
    }).then((res) => res.json());
    assert(bridgeTest.ok === true && bridgeTest.data?.delivered === true, "IM bridge test send failed.");

    const inbound = await fetch(`http://127.0.0.1:${sidecarPort}/api/im-bridge/inbound/generic`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bridge-token",
      },
      body: JSON.stringify({
        text: "/agent smoke agent",
        userId: "mobile-user-1",
      }),
    }).then((res) => res.json());
    assert(inbound.ok === true, "IM bridge inbound failed.");
    assert(inbound.data?.delivered === true, "IM bridge inbound reply not delivered.");
    assert(replyReceipts.length >= 2, "IM bridge did not hit reply webhook.");
    const feishuInbound = await fetch(`http://127.0.0.1:${sidecarPort}/api/im-bridge/inbound/feishu`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bridge-token",
      },
      body: JSON.stringify({
        token: "feishu-verify-token",
        event: {
          sender: { sender_id: { open_id: "ou-smoke-user" } },
          message: {
            chat_id: "oc-smoke-chat",
            content: JSON.stringify({ text: "/agent smoke agent" }),
          },
        },
      }),
    }).then((res) => res.json());
    assert(feishuInbound.ok === true, "Feishu IM bridge inbound failed.");
    assert(feishuApiReceipts.length >= 1, "Feishu official API send not triggered.");
    const dingTimestamp = String(Date.now());
    const dingStringToSign = `${dingTimestamp}\nding-sign-secret`;
    const dingSign = crypto
      .createHmac("sha256", "ding-sign-secret")
      .update(dingStringToSign, "utf8")
      .digest("base64");
    const dingtalkInbound = await fetch(
      `http://127.0.0.1:${sidecarPort}/api/im-bridge/inbound/dingtalk?timestamp=${encodeURIComponent(
        dingTimestamp,
      )}&sign=${encodeURIComponent(dingSign)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer bridge-token",
        },
        body: JSON.stringify({
          conversationId: "cid-smoke-chat",
          senderStaffId: "staff-smoke-user",
          text: {
            content: "/agent smoke agent",
          },
        }),
      },
    ).then((res) => res.json());
    assert(dingtalkInbound.ok === true, "DingTalk IM bridge inbound failed.");
    assert(dingtalkApiReceipts.length >= 1, "DingTalk official API send not triggered.");
    const bridgeEvents = await fetch(`http://127.0.0.1:${sidecarPort}/api/im-bridge/events?limit=10`).then((res) =>
      res.json(),
    );
    assert(bridgeEvents.ok === true, "IM bridge events failed.");
    assert(Array.isArray(bridgeEvents.data?.events), "IM bridge events payload invalid.");
    assert(
      bridgeEvents.data.events.some((item) => item.kind === "inbound" && item.provider === "generic"),
      "IM bridge inbound event missing.",
    );
    assert(
      bridgeEvents.data.events.some((item) => item.kind === "test" && item.provider === "generic"),
      "IM bridge test event missing.",
    );
    const inboundEvent = bridgeEvents.data.events.find(
      (item) => item.kind === "inbound" && item.provider === "generic",
    );
    assert(inboundEvent && inboundEvent.retryable === true, "IM bridge inbound event should be retryable.");
    const retried = await fetch(
      `http://127.0.0.1:${sidecarPort}/api/im-bridge/events/${inboundEvent.id}/retry`,
      {
        method: "POST",
      },
    ).then((res) => res.json());
    assert(retried.ok === true, "IM bridge event retry failed.");
    assert(
      typeof retried.data?.event?.sourceEventId === "string" && retried.data.event.sourceEventId === inboundEvent.id,
      "IM bridge retry event source link missing.",
    );

    if (hasCommand("ffmpeg")) {
      const sampleVideoPath = await createSampleVideo(tempDir);
      const fileBlob = new Blob([await readFile(sampleVideoPath)], { type: "video/mp4" });
      const form = new FormData();
      form.append("prompt", "从第0秒开始截取1秒，并在第1秒抽帧做封面");
      form.append("file", fileBlob, "sample.mp4");

      const execute = await fetch(`http://127.0.0.1:${sidecarPort}/api/openclaw/execute`, {
        method: "POST",
        body: form,
      }).then((res) => res.json());
      assert(execute.ok === true, "Execute route failed.");
      assert(typeof execute.output?.coverSrc === "string", "Execute cover output missing.");
    } else {
      assert(
        runtimeDoctor.data?.report?.readiness?.creativeStudioReady === false,
        "Creative Studio should be reported as unavailable when ffmpeg is missing.",
      );
      console.log("Skipping Creative Studio execute smoke because ffmpeg is not installed.");
    }

    console.log("AgentCore sidecar smoke test passed.");
  } finally {
    await stopProcess(sidecar);
    await Promise.all([
      new Promise((resolve) => llmServer.close(resolve)),
      new Promise((resolve) => connectorServer.close(resolve)),
      new Promise((resolve) => replyServer.close(resolve)),
      new Promise((resolve) => feishuApiServer.close(resolve)),
      new Promise((resolve) => dingtalkApiServer.close(resolve)),
    ]);
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "Sidecar smoke test failed.");
});
