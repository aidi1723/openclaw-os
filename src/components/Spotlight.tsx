"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask, type TaskId } from "@/lib/tasks";

type SpotlightApp = { id: string; name: string };

type SpotlightHistoryEntry =
  | { kind: "app"; id: string; name: string; ts: number; count: number }
  | { kind: "command"; text: string; ts: number; count: number };

type SpotlightItem =
  | { kind: "command"; title: string; subtitle: string; message: string }
  | { kind: "app"; app: SpotlightApp; meta?: string }
  | { kind: "action"; id: string; title: string; subtitle: string; action: () => void | Promise<void> };

const HISTORY_KEY = "openclaw.spotlight.history";
const HISTORY_MAX = 40;

function loadHistory(): SpotlightHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x) => x as any)
      .filter((x) => x && typeof x === "object")
      .filter((x) => x.kind === "app" || x.kind === "command")
      .map((x) => {
        if (x.kind === "app") {
          return {
            kind: "app" as const,
            id: String(x.id ?? ""),
            name: String(x.name ?? ""),
            ts: Number.isFinite(x.ts) ? Number(x.ts) : Date.now(),
            count: Number.isFinite(x.count) ? Number(x.count) : 1,
          };
        }
        return {
          kind: "command" as const,
          text: String(x.text ?? ""),
          ts: Number.isFinite(x.ts) ? Number(x.ts) : Date.now(),
          count: Number.isFinite(x.count) ? Number(x.count) : 1,
        };
      })
      .filter((x) => (x.kind === "app" ? Boolean(x.id) : Boolean(x.text)))
      .sort((a, b) => b.ts - a.ts)
      .slice(0, HISTORY_MAX);
  } catch {
    return [];
  }
}

function saveHistory(entries: SpotlightHistoryEntry[]) {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
  } catch {
    // ignore
  }
}

export function Spotlight({
  open,
  onClose,
  apps = [],
  onOpenApp,
}: {
  open: boolean;
  onClose: () => void;
  apps?: SpotlightApp[];
  onOpenApp?: (appId: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState("");
  const [result, setResult] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const taskIdRef = useRef<TaskId | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [history, setHistory] = useState<SpotlightHistoryEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    setValue("");
    setResult("");
    setIsRunning(false);
    setActiveIndex(0);
    setHistory(loadHistory());
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(id);
      restoreFocusRef.current?.focus?.();
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const pushHistory = (
    entry:
      | { kind: "app"; id: string; name: string }
      | { kind: "command"; text: string },
  ) => {
    setHistory((prev) => {
      const now = Date.now();
      const next = [...prev];
      const idx =
        entry.kind === "app"
          ? next.findIndex((x) => x.kind === "app" && x.id === entry.id)
          : next.findIndex((x) => x.kind === "command" && x.text === entry.text);
      if (idx >= 0) {
        const cur = next[idx] as any;
        next[idx] = { ...cur, ts: now, count: (cur.count ?? 1) + 1 };
      } else {
        next.unshift(
          entry.kind === "app"
            ? { kind: "app", id: entry.id, name: entry.name, ts: now, count: 1 }
            : { kind: "command", text: entry.text, ts: now, count: 1 },
        );
      }
      const trimmed = next.sort((a, b) => b.ts - a.ts).slice(0, HISTORY_MAX);
      saveHistory(trimmed);
      return trimmed;
    });
  };

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    setResult("已清空 Spotlight 记录。");
  }, []);

  const run = async (rawMessage?: string) => {
    const message = (rawMessage ?? value).trim().replace(/^>\s*/, "");
    if (!message || isRunning) return;

    const lower = message.toLowerCase();
    if (
      lower === "clear history" ||
      lower === "history clear" ||
      lower === "clear" ||
      message === "清空" ||
      message === "清空记录" ||
      message === "清除记录"
    ) {
      clearHistory();
      return;
    }

    setIsRunning(true);
    setResult("");
    taskIdRef.current = createTask({
      name: "Assistant - Spotlight Command",
      status: "running",
      detail: message.slice(0, 80),
    });
    pushHistory({ kind: "command", text: message });

    try {
      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-spotlight",
      });
      setResult(text || "（无输出）");
      if (taskIdRef.current) updateTask(taskIdRef.current, { status: "done" });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "请求异常";
      setResult(errorMessage);
      if (taskIdRef.current) {
        updateTask(taskIdRef.current, { status: "error", detail: errorMessage });
      }
    } finally {
      setIsRunning(false);
    }
  };

  const items = useMemo(() => {
    const raw = value.trim();
    const stripped = raw.replace(/^>\s*/, "");
    const q = stripped.toLowerCase();
    const isHelp = q === "?" || q === "help";
    const forceCommand = raw.startsWith(">");

    const appById = new Map(apps.map((a) => [a.id, a] as const));
    const recentApps = history
      .filter((h): h is Extract<SpotlightHistoryEntry, { kind: "app" }> => h.kind === "app")
      .filter((h) => appById.has(h.id));
    const recentCommands = history.filter((h): h is Extract<SpotlightHistoryEntry, { kind: "command" }> => h.kind === "command");
    const appRecency = new Map<string, number>(recentApps.map((h) => [h.id, h.ts]));

    const list: SpotlightItem[] = [];

    if (isHelp) {
      list.push(
        {
          kind: "action",
          id: "help:cmd",
          title: "指令模式",
          subtitle: "用 `>` 前缀执行 Assistant 指令（例如：`> 帮我写一段文案`）。",
          action: () => setValue("> "),
        },
        {
          kind: "action",
          id: "help:clear",
          title: "清空 Spotlight 记录",
          subtitle: "清除最近打开的应用与指令（仅本地）。",
          action: () => clearHistory(),
        },
      );

      if (recentCommands.length > 0) {
        for (const c of recentCommands.slice(0, 4)) {
          list.push({
            kind: "command",
            title: `Recent: ${c.text.slice(0, 64)}`,
            subtitle: "Enter to re-run",
            message: c.text,
          });
        }
      }
      return list;
    }

    const hasQuery = Boolean(q);
    if (forceCommand && !hasQuery) {
      list.push({
        kind: "action",
        id: "cmd:help",
        title: "指令模式已开启",
        subtitle: "输入内容后回车执行；输入 `?` 查看帮助。",
        action: () => setValue("?"),
      });
      for (const c of recentCommands.slice(0, 6)) {
        list.push({
          kind: "command",
          title: `Recent: ${c.text.slice(0, 64)}`,
          subtitle: "Enter to re-run",
          message: c.text,
        });
      }
      return list;
    }
    const showCommand = forceCommand || hasQuery;
    if (showCommand) {
      list.push({
        kind: "command",
        title: `执行指令：${stripped || q}`,
        subtitle: "Enter：执行 · ↑↓：选择 · ESC：关闭 · 输入 `?` 查看帮助",
        message: stripped,
      });
    }

    const appMatches = hasQuery
      ? apps
          .filter((a) => {
            const hay = `${a.name} ${a.id}`.toLowerCase();
            return hay.includes(q);
          })
          .sort((a, b) => (appRecency.get(b.id) ?? 0) - (appRecency.get(a.id) ?? 0))
          .slice(0, 7)
      : [
          ...recentApps
            .slice(0, 5)
            .map((h) => appById.get(h.id) ?? ({ id: h.id, name: h.name } as SpotlightApp))
            .filter((a, idx, arr) => arr.findIndex((x) => x.id === a.id) === idx)
            .filter((a) => appById.has(a.id)),
          ...apps.filter((a) => !appRecency.has(a.id)),
        ].slice(0, 7);

    for (const app of appMatches) {
      const ts = appRecency.get(app.id);
      list.push({ kind: "app", app, meta: ts ? "最近打开" : undefined });
    }

    if (!hasQuery && recentCommands.length > 0) {
      list.push({
        kind: "action",
        id: "recent:help",
        title: "Spotlight 帮助",
        subtitle: "输入 `?` 查看帮助与可用操作。",
        action: () => setValue("?"),
      });
      for (const c of recentCommands.slice(0, 2)) {
        list.push({
          kind: "command",
          title: `Recent: ${c.text.slice(0, 64)}`,
          subtitle: "Enter to re-run",
          message: c.text,
        });
      }
    }

    return list;
  }, [apps, clearHistory, history, value]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
  }, [open, value]);

  const activate = async () => {
    const item = items[activeIndex] ?? null;
    if (!item) return;
    if (item.kind === "app") {
      pushHistory({ kind: "app", id: item.app.id, name: item.app.name });
      onOpenApp?.(item.app.id);
      onClose();
      return;
    }
    if (item.kind === "action") {
      await item.action();
      return;
    }
    await run(item.message);
  };

  const activateIndex = async (idx: number) => {
    setActiveIndex(idx);
    const item = items[idx];
    if (!item) return;

    if (item.kind === "app") {
      pushHistory({ kind: "app", id: item.app.id, name: item.app.name });
      onOpenApp?.(item.app.id);
      onClose();
      return;
    }

    if (item.kind === "action") {
      await item.action();
      return;
    }

    await run(item.message);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center px-3 pt-6 sm:px-6 sm:pt-16 lg:pt-28"
      role="dialog"
      aria-modal="true"
      aria-label="Spotlight"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[820px]">
        <div className="rounded-[28px] border border-white/20 bg-white/10 backdrop-blur-2xl shadow-[0_25px_80px_rgba(0,0,0,0.45)] overflow-hidden">
          <div className="px-6 py-5">
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  activate();
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, items.length - 1)));
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIndex((prev) => Math.max(0, prev - 1));
                }
                if (e.key === "Tab") {
                  e.preventDefault();
                  inputRef.current?.focus();
                }
              }}
              placeholder="Spotlight: 输入指令或搜索应用..."
              className="w-full bg-transparent text-white placeholder:text-white/55 text-lg font-semibold tracking-tight focus:outline-none"
              aria-label="Spotlight Input"
            />
          </div>
          <div className="h-px bg-white/10" />
          <div className="max-h-[min(72vh,720px)] overflow-auto px-4 py-4 sm:px-6">
            <div className="space-y-3">
              {items.length > 0 ? (
                <div
                  role="listbox"
                  aria-label="Spotlight results"
                  className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden"
                >
                  {items.map((item, idx) => {
                    const active = idx === activeIndex;
                    if (item.kind === "command") {
                      return (
                        <button
                          key={`cmd:${idx}`}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => void activateIndex(idx)}
                          className={[
                            "w-full text-left px-4 py-3 transition-colors",
                            active ? "bg-white/10" : "hover:bg-white/5",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-white/90">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-white/55 mt-0.5">
                            {item.subtitle}
                          </div>
                        </button>
                      );
                    }
                    if (item.kind === "action") {
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => void activateIndex(idx)}
                          className={[
                            "w-full text-left px-4 py-3 transition-colors",
                            active ? "bg-white/10" : "hover:bg-white/5",
                          ].join(" ")}
                        >
                          <div className="text-sm font-semibold text-white/90">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-white/55 mt-0.5">
                            {item.subtitle}
                          </div>
                        </button>
                      );
                    }
                    return (
                      <button
                        key={item.app.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={() => void activateIndex(idx)}
                        className={[
                          "w-full flex items-center justify-between gap-3 text-left px-4 py-3 transition-colors",
                          active ? "bg-white/10" : "hover:bg-white/5",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-white/90 truncate">
                            {item.app.name}
                          </div>
                          <div className="text-[11px] text-white/50 mt-0.5 font-mono truncate">
                            {item.app.id}
                          </div>
                        </div>
                        <div className="text-[11px] text-white/55">
                          {item.meta ?? "打开"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-white/55">
                  输入内容以执行指令，或搜索应用。
                </div>
              )}

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                {isRunning ? (
                  <div className="text-xs text-white/65">Assistant 正在处理...</div>
                ) : result ? (
                  <pre className="max-h-[32vh] overflow-auto whitespace-pre-wrap text-xs leading-relaxed text-white/85">
                    {result}
                  </pre>
                ) : (
                  <div className="text-xs text-white/55">
                    提示：Enter 执行 · ↑↓ 选择 · ESC 关闭 · 用 <span className="font-mono">{">"}</span> 强制指令模式
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
