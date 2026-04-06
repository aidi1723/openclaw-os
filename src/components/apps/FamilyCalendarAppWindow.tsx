"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FilePlus2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createFamilyEvent,
  createHouseholdItem,
  getFamilyEvents,
  getHouseholdItems,
  removeFamilyEvent,
  removeHouseholdItem,
  subscribeHousehold,
  updateFamilyEvent,
  updateHouseholdItem,
  type FamilyEvent,
  type HouseholdItem,
} from "@/lib/household";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp } from "@/lib/ui-events";

function buildLocalPlan(events: FamilyEvent[], items: HouseholdItem[], focusDate: string) {
  const sameDay = events.filter((event) => event.date === focusDate);
  const neededItems = items.filter((item) => item.needed);
  return [
    "【Family Morning Plan】",
    `- 日期：${focusDate || "今天"}`,
    "",
    "【日程】",
    ...(sameDay.length > 0
      ? sameDay.map((event) => `- ${event.time || "--:--"} ${event.member || "家庭成员"}：${event.title}`)
      : ["- 今天还没有记录的家庭日程。"]),
    "",
    "【补货 / 家务】",
    ...(neededItems.length > 0
      ? neededItems.map((item) => `- ${item.name}${item.quantity ? ` | 余量：${item.quantity}` : ""}`)
      : ["- 暂无待补货项目。"]),
    "",
    "【建议】",
    "- 先确认今天必须外出的事项和接送时间。",
    "- 把需要采购或提醒的事项转成任务，避免晨间遗漏。",
    "- 如有多人协同，建议提前发一条家庭群提醒。",
  ].join("\n");
}

export function FamilyCalendarAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const nextEvents = getFamilyEvents();
      const nextItems = getHouseholdItems();
      setEvents(nextEvents);
      setItems(nextItems);
      setSelectedEventId((current) => current ?? nextEvents[0]?.id ?? null);
      setSelectedItemId((current) => current ?? nextItems[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeHousehold(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const createNewEvent = () => {
    const id = createFamilyEvent({ date: focusDate });
    setSelectedEventId(id);
    showToast("已新增家庭日程", "ok");
  };

  const createNewItem = () => {
    const id = createHouseholdItem();
    setSelectedItemId(id);
    showToast("已新增家庭物品", "ok");
  };

  const generatePlan = async () => {
    const fallback = buildLocalPlan(events, items, focusDate);
    const taskId = createTask({
      name: "Assistant - Family calendar plan",
      status: "running",
      detail: focusDate,
    });
    setIsGenerating(true);
    try {
      const dayEvents = events
        .filter((event) => event.date === focusDate)
        .map((event) => `- ${event.time || "--:--"} | ${event.member || "成员"} | ${event.title} | ${event.notes}`)
        .join("\n");
      const stock = items
        .filter((item) => item.needed)
        .map((item) => `- ${item.name} | 余量: ${item.quantity || "未知"} | ${item.notes}`)
        .join("\n");
      const message =
        "你是 Family Calendar & Household Assistant。请基于家庭日程和待补货事项，生成一份中文晨间计划。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先列出今天关键安排。\n" +
        "2) 再列出需要提醒或采购的事项。\n" +
        "3) 给出一段简短的家庭协作建议。\n\n" +
        `日期：${focusDate}\n` +
        `日程：\n${dayEvents || "(空)"}\n` +
        `补货/家务：\n${stock || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-family-calendar",
        timeoutSeconds: 90,
      });
      setPlan(text || fallback);
      updateTask(taskId, { status: "done" });
      showToast("家庭计划已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setPlan(fallback);
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地计划", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlanDraft = () => {
    if (!plan.trim()) {
      showToast("请先生成家庭计划", "error");
      return;
    }
    createDraft({
      title: `Family Plan ${focusDate}`,
      body: plan,
      tags: ["family", "calendar"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const queueNeededItems = () => {
    const neededItems = items.filter((item) => item.needed);
    if (neededItems.length === 0) {
      showToast("当前没有待补货项目", "error");
      return;
    }
    for (const item of neededItems) {
      createTask({
        name: `Family - ${item.name}`,
        status: "queued",
        detail: item.quantity || "家庭补货 / 处理",
      });
    }
    requestOpenApp("task_manager");
    showToast(`已写入 ${neededItems.length} 个家庭任务`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Family Calendar"
      icon={CalendarDays}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.family_calendar"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-lg font-bold text-gray-900">Family Calendar & Household Assistant</div>
              <div className="mt-1 text-sm text-gray-500">
                聚合家庭日程、家务与补货事项，生成一份晨间家庭计划。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                日程 {events.length}
              </div>
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700">
                家务 / 补货 {items.length}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 xl:grid-cols-[330px_330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">家庭日程</div>
                <button
                  type="button"
                  onClick={createNewEvent}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {events.length > 0 ? (
                  events.slice(0, 8).map((event) => {
                    const active = event.id === selectedEventId;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{event.title}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {[event.date, event.time, event.member].filter(Boolean).join(" · ") || "待补充"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有家庭日程。
                  </div>
                )}
              </div>
            </div>

            {selectedEvent && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">编辑日程</div>
                  <button
                    type="button"
                    onClick={() => {
                      removeFamilyEvent(selectedEvent.id);
                      setSelectedEventId(null);
                      showToast("家庭日程已删除", "ok");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </button>
                </div>

                <input
                  value={selectedEvent.title}
                  onChange={(e) => updateFamilyEvent(selectedEvent.id, { title: e.target.value })}
                  placeholder="事项"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={selectedEvent.member}
                  onChange={(e) => updateFamilyEvent(selectedEvent.id, { member: e.target.value })}
                  placeholder="成员"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={selectedEvent.date}
                    onChange={(e) => updateFamilyEvent(selectedEvent.id, { date: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="time"
                    value={selectedEvent.time}
                    onChange={(e) => updateFamilyEvent(selectedEvent.id, { time: e.target.value })}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <textarea
                  value={selectedEvent.notes}
                  onChange={(e) => updateFamilyEvent(selectedEvent.id, { notes: e.target.value })}
                  placeholder="备注"
                  className="h-28 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </aside>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-gray-900">补货 / 家务</div>
                <button
                  type="button"
                  onClick={createNewItem}
                  className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                >
                  <Plus className="h-4 w-4" />
                  新建
                </button>
              </div>

              <div className="mt-3 space-y-2">
                {items.length > 0 ? (
                  items.slice(0, 8).map((item) => {
                    const active = item.id === selectedItemId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={[
                          "w-full rounded-2xl border p-3 text-left transition-colors",
                          active
                            ? "border-gray-900 bg-gray-900 text-white"
                            : "border-gray-200 bg-gray-50 hover:bg-gray-100",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold">{item.name}</div>
                        <div className={["mt-1 text-xs", active ? "text-white/75" : "text-gray-500"].join(" ")}>
                          {item.needed ? "待处理" : "正常"} {item.quantity ? `· ${item.quantity}` : ""}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
                    还没有家庭物品。
                  </div>
                )}
              </div>
            </div>

            {selectedItem && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">编辑物品</div>
                  <button
                    type="button"
                    onClick={() => {
                      removeHouseholdItem(selectedItem.id);
                      setSelectedItemId(null);
                      showToast("家庭物品已删除", "ok");
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除
                  </button>
                </div>

                <input
                  value={selectedItem.name}
                  onChange={(e) => updateHouseholdItem(selectedItem.id, { name: e.target.value })}
                  placeholder="物品"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={selectedItem.quantity}
                  onChange={(e) => updateHouseholdItem(selectedItem.id, { quantity: e.target.value })}
                  placeholder="余量 / 数量"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedItem.needed}
                    onChange={(e) => updateHouseholdItem(selectedItem.id, { needed: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  标记为待补货 / 待处理
                </label>
                <textarea
                  value={selectedItem.notes}
                  onChange={(e) => updateHouseholdItem(selectedItem.id, { notes: e.target.value })}
                  placeholder="备注"
                  className="h-24 w-full resize-none rounded-2xl border border-gray-300 px-4 py-3 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </aside>

          <main className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex-1">
                  <label className="mb-2 block text-xs font-semibold text-gray-600">计划日期</label>
                  <input
                    type="date"
                    value={focusDate}
                    onChange={(e) => setFocusDate(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={generatePlan}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isGenerating ? "生成中..." : "生成家庭计划"}
                  </button>
                  <button
                    type="button"
                    onClick={savePlanDraft}
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-100"
                  >
                    <FilePlus2 className="h-4 w-4" />
                    保存草稿
                  </button>
                  <button
                    type="button"
                    onClick={queueNeededItems}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 transition-colors hover:bg-gray-50"
                  >
                    写入家庭任务
                  </button>
                </div>
              </div>

              <div className="min-h-[560px] pt-4">
                {plan ? (
                  <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{plan}</pre>
                ) : (
                  <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 text-sm text-gray-500">
                    生成后，这里会出现家庭晨间计划。
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
