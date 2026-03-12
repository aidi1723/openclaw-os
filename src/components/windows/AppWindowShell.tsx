"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Minus, X } from "lucide-react";

type DragOffset = { dx: number; dy: number };
type WindowSize = { width: number; height: number };

type PersistedWindowGeometry = {
  dx: number;
  dy: number;
  width?: number;
  height?: number;
};

type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

type WindowCommand =
  | "tile_left"
  | "tile_right"
  | "tile_top"
  | "tile_bottom"
  | "maximize"
  | "restore"
  | "center";

const DOCK_BOTTOM_SAFE = 96;
const WINDOW_MARGIN = 10;

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function loadGeometry(storageKey: string): PersistedWindowGeometry | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      isNumber((parsed as any).dx) &&
      isNumber((parsed as any).dy)
    ) {
      const dx = (parsed as any).dx as number;
      const dy = (parsed as any).dy as number;
      const width = isNumber((parsed as any).width) ? ((parsed as any).width as number) : undefined;
      const height = isNumber((parsed as any).height) ? ((parsed as any).height as number) : undefined;
      return { dx, dy, width, height };
    }
    return null;
  } catch {
    return null;
  }
}

function saveGeometry(storageKey: string, geom: PersistedWindowGeometry) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(geom));
  } catch {
    // ignore
  }
}

function removeGeometry(storageKey: string) {
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // ignore
  }
}

function restoreKey(storageKey: string) {
  return `${storageKey}.restore`;
}

function loadRestoreGeometry(storageKey: string): PersistedWindowGeometry | null {
  return loadGeometry(restoreKey(storageKey));
}

function saveRestoreGeometry(storageKey: string, geom: PersistedWindowGeometry) {
  saveGeometry(restoreKey(storageKey), geom);
}

function removeRestoreGeometry(storageKey: string) {
  removeGeometry(restoreKey(storageKey));
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function windowBounds() {
  const left = WINDOW_MARGIN;
  const top = WINDOW_MARGIN;
  const right = window.innerWidth - WINDOW_MARGIN;
  const bottom = window.innerHeight - DOCK_BOTTOM_SAFE - WINDOW_MARGIN;
  return { left, top, right, bottom };
}

function minimumSizeForViewport(minSize?: WindowSize) {
  const bounds = windowBounds();
  const availableWidth = Math.max(240, bounds.right - bounds.left);
  const availableHeight = Math.max(180, bounds.bottom - bounds.top);
  return {
    width: Math.min(minSize?.width ?? 420, availableWidth),
    height: Math.min(minSize?.height ?? 260, availableHeight),
  };
}

function toDragOffsetFromLeftTop(size: WindowSize, left: number, top: number): DragOffset {
  const baseLeft = window.innerWidth / 2 - size.width / 2;
  const baseTop = window.innerHeight / 2 - size.height / 2;
  return { dx: left - baseLeft, dy: top - baseTop };
}

function toLeftTopFromDragOffset(size: WindowSize, offset: DragOffset) {
  const baseLeft = window.innerWidth / 2 - size.width / 2;
  const baseTop = window.innerHeight / 2 - size.height / 2;
  return { left: baseLeft + offset.dx, top: baseTop + offset.dy };
}

export function AppWindowShell({
  state,
  zIndex,
  active = false,
  title,
  icon: Icon,
  widthClassName = "w-[620px]",
  storageKey,
  defaultSize,
  minSize,
  onFocus,
  onMinimize,
  onClose,
  children,
}: {
  state: "opening" | "open" | "minimized" | "closing";
  zIndex: number;
  active?: boolean;
  title: string;
  icon: LucideIcon;
  widthClassName?: string;
  storageKey?: string;
  defaultSize?: WindowSize;
  minSize?: WindowSize;
  onFocus: () => void;
  onMinimize: () => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const windowRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<DragOffset>({ dx: 0, dy: 0 });
  const windowSizeRef = useRef<WindowSize | null>(null);
  const dragContextRef = useRef<{
    startX: number;
    startY: number;
    startDx: number;
    startDy: number;
    width: number;
    height: number;
    baseLeft: number;
    baseTop: number;
  } | null>(null);
  const resizeContextRef = useRef<{
    startX: number;
    startY: number;
    startRect: { left: number; top: number; width: number; height: number };
    handle: ResizeHandle;
  } | null>(null);

  const [dragOffset, setDragOffset] = useState<DragOffset>({ dx: 0, dy: 0 });
  const [windowSize, setWindowSize] = useState<WindowSize | null>(defaultSize ?? null);

  const isDraggable = state === "open" || state === "opening";

  useEffect(() => {
    if (!storageKey) return;
    const saved = loadGeometry(storageKey);
    if (!saved) return;
    setDragOffset({ dx: saved.dx, dy: saved.dy });
    if (isNumber(saved.width) && isNumber(saved.height)) {
      setWindowSize({ width: saved.width, height: saved.height });
    }
  }, [storageKey]);

  useEffect(() => {
    dragOffsetRef.current = dragOffset;
  }, [dragOffset]);

  useEffect(() => {
    windowSizeRef.current = windowSize;
  }, [windowSize]);

  useEffect(() => {
    if (windowSize) return;
    if (!windowRef.current) return;
    const rect = windowRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    setWindowSize({ width: rect.width, height: rect.height });
  }, [windowSize]);

  const chromeClassName = useMemo(() => {
    return [
      "fixed left-1/2 top-1/2 flex max-h-[calc(100vh-106px)] max-w-[calc(100vw-20px)] flex-col overflow-hidden rounded-[24px] sm:rounded-3xl",
      "border border-white/30 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,252,0.84)_100%)] backdrop-blur-3xl",
      "shadow-[0_28px_90px_rgba(0,0,0,0.36)]",
      widthClassName,
      "transition-[opacity,transform,box-shadow] duration-200 ease-out",
      active ? "ring-1 ring-white/45 shadow-[0_32px_100px_rgba(0,0,0,0.42)]" : "ring-0",
    ].join(" ");
  }, [active, widthClassName]);

  const persistGeometry = useCallback(() => {
    if (!storageKey) return;
    const s = windowSizeRef.current;
    const o = dragOffsetRef.current;
    if (!s) {
      saveGeometry(storageKey, { dx: o.dx, dy: o.dy });
      return;
    }
    saveGeometry(storageKey, { dx: o.dx, dy: o.dy, width: s.width, height: s.height });
  }, [storageKey]);

  const applyLeftTopSize = useCallback(
    (next: { left: number; top: number; width: number; height: number }, opts?: { persist?: boolean }) => {
      const bounds = windowBounds();
      const minViewportSize = minimumSizeForViewport(minSize);
      const minW = minViewportSize.width;
      const minH = minViewportSize.height;

      let width = Math.max(minW, Math.round(next.width));
      let height = Math.max(minH, Math.round(next.height));

      width = Math.min(width, Math.max(minW, bounds.right - bounds.left));
      height = Math.min(height, Math.max(minH, bounds.bottom - bounds.top));

      let left = Math.round(next.left);
      let top = Math.round(next.top);

      left = clamp(left, bounds.left, bounds.right - width);
      top = clamp(top, bounds.top, bounds.bottom - height);

      const size: WindowSize = { width, height };
      const offset = toDragOffsetFromLeftTop(size, left, top);

      windowSizeRef.current = size;
      dragOffsetRef.current = offset;
      setWindowSize(size);
      setDragOffset(offset);
      if (opts?.persist) persistGeometry();
    },
    [minSize, persistGeometry],
  );

  const onTitleBarPointerDown = (e: React.PointerEvent) => {
    onFocus();
    if (!isDraggable) return;
    if (!windowRef.current) return;

    const rect = windowRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const baseLeft = window.innerWidth / 2 - width / 2;
    const baseTop = window.innerHeight / 2 - height / 2;

    dragContextRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startDx: dragOffset.dx,
      startDy: dragOffset.dy,
      width,
      height,
      baseLeft,
      baseTop,
    };

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onTitleBarPointerMove = (e: React.PointerEvent) => {
    if (!isDraggable) return;
    const ctx = dragContextRef.current;
    if (!ctx) return;

    const nextDx = ctx.startDx + (e.clientX - ctx.startX);
    const nextDy = ctx.startDy + (e.clientY - ctx.startY);

    const margin = 10;
    const dockBottomSafe = 96;
    const snap = 18;

    const minDx = margin - ctx.baseLeft;
    const maxDx = window.innerWidth - ctx.width - margin - ctx.baseLeft;
    const minDy = margin - ctx.baseTop;
    const maxDy =
      window.innerHeight - dockBottomSafe - ctx.height - margin - ctx.baseTop;

    const clampedDx = Math.min(Math.max(nextDx, minDx), maxDx);
    const clampedDy = Math.min(Math.max(nextDy, minDy), maxDy);

    setDragOffset({
      dx: Math.abs(clampedDx - minDx) <= snap ? minDx : Math.abs(clampedDx - maxDx) <= snap ? maxDx : clampedDx,
      dy: Math.abs(clampedDy - minDy) <= snap ? minDy : Math.abs(clampedDy - maxDy) <= snap ? maxDy : clampedDy,
    });
  };

  const onTitleBarPointerUp = () => {
    dragContextRef.current = null;
    persistGeometry();
  };

  const isHidden = state === "minimized" || state === "closing";
  const scale = state === "open" ? 1 : 0.98;
  const translateY = state === "minimized" ? 26 : state === "open" ? 0 : 10;

  const startResize = (handle: ResizeHandle) => (e: React.PointerEvent) => {
    onFocus();
    if (!isDraggable) return;
    if (!windowRef.current) return;
    e.stopPropagation();
    const rect = windowRef.current.getBoundingClientRect();
    resizeContextRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      handle,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onResizePointerMove = (e: React.PointerEvent) => {
    if (!isDraggable) return;
    const ctx = resizeContextRef.current;
    if (!ctx) return;
    const dx = e.clientX - ctx.startX;
    const dy = e.clientY - ctx.startY;

    const start = ctx.startRect;
    const startRight = start.left + start.width;
    const startBottom = start.top + start.height;

    let left = start.left;
    let top = start.top;
    let width = start.width;
    let height = start.height;

    if (ctx.handle.includes("e")) width = start.width + dx;
    if (ctx.handle.includes("s")) height = start.height + dy;
    if (ctx.handle.includes("w")) {
      width = start.width - dx;
      left = start.left + dx;
    }
    if (ctx.handle.includes("n")) {
      height = start.height - dy;
      top = start.top + dy;
    }

    // Keep opposite edge stable when clamping.
    const minViewportSize = minimumSizeForViewport(minSize);
    const minW = minViewportSize.width;
    const minH = minViewportSize.height;
    if (width < minW) {
      width = minW;
      if (ctx.handle.includes("w")) left = startRight - width;
    }
    if (height < minH) {
      height = minH;
      if (ctx.handle.includes("n")) top = startBottom - height;
    }

    // Clamp to viewport bounds.
    const bounds = windowBounds();
    if (left < bounds.left) {
      if (ctx.handle.includes("w")) {
        left = bounds.left;
        width = startRight - left;
      } else {
        left = bounds.left;
      }
    }
    if (top < bounds.top) {
      if (ctx.handle.includes("n")) {
        top = bounds.top;
        height = startBottom - top;
      } else {
        top = bounds.top;
      }
    }
    if (left + width > bounds.right) {
      if (ctx.handle.includes("e")) {
        width = bounds.right - left;
      } else {
        left = bounds.right - width;
      }
    }
    if (top + height > bounds.bottom) {
      if (ctx.handle.includes("s")) {
        height = bounds.bottom - top;
      } else {
        top = bounds.bottom - height;
      }
    }

    applyLeftTopSize({ left, top, width, height });
  };

  const onResizePointerUp = () => {
    resizeContextRef.current = null;
    persistGeometry();
  };

  const onDoubleClickTitleBar = () => {
    setDragOffset({ dx: 0, dy: 0 });
    setWindowSize(defaultSize ?? null);
    if (storageKey) {
      removeGeometry(storageKey);
      removeRestoreGeometry(storageKey);
    }
  };

  const onWindowCommand = useCallback(
    (command: WindowCommand) => {
      if (!isDraggable) return;
      if (!windowRef.current) return;
      if (!storageKey) return;

      const rect = windowRef.current.getBoundingClientRect();
      const currentSize: WindowSize = { width: rect.width, height: rect.height };
      const currentOffset: DragOffset = dragOffsetRef.current;
      const { left: curLeft, top: curTop } = toLeftTopFromDragOffset(currentSize, currentOffset);

      const currentGeom: PersistedWindowGeometry = {
        dx: currentOffset.dx,
        dy: currentOffset.dy,
        width: currentSize.width,
        height: currentSize.height,
      };

      const bounds = windowBounds();
      const maxW = bounds.right - bounds.left;
      const maxH = bounds.bottom - bounds.top;

      const saveRestore = () => saveRestoreGeometry(storageKey, currentGeom);

      if (command === "center") {
        applyLeftTopSize({ left: window.innerWidth / 2 - currentSize.width / 2, top: window.innerHeight / 2 - currentSize.height / 2, width: currentSize.width, height: currentSize.height }, { persist: true });
        return;
      }

      if (command === "restore") {
        const saved = loadRestoreGeometry(storageKey);
        if (saved && isNumber(saved.width) && isNumber(saved.height)) {
          const size = { width: saved.width, height: saved.height };
          const { left, top } = toLeftTopFromDragOffset(size, { dx: saved.dx, dy: saved.dy });
          applyLeftTopSize({ left, top, width: size.width, height: size.height }, { persist: true });
        }
        return;
      }

      if (command === "maximize") {
        saveRestore();
        applyLeftTopSize(
          { left: bounds.left, top: bounds.top, width: maxW, height: maxH },
          { persist: true },
        );
        return;
      }

      if (command === "tile_left") {
        saveRestore();
        const w = Math.floor((maxW - WINDOW_MARGIN) / 2);
        applyLeftTopSize(
          { left: bounds.left, top: bounds.top, width: w, height: maxH },
          { persist: true },
        );
        return;
      }

      if (command === "tile_right") {
        saveRestore();
        const w = Math.floor((maxW - WINDOW_MARGIN) / 2);
        applyLeftTopSize(
          { left: bounds.right - w, top: bounds.top, width: w, height: maxH },
          { persist: true },
        );
        return;
      }

      if (command === "tile_top") {
        saveRestore();
        const h = Math.floor((maxH - WINDOW_MARGIN) / 2);
        applyLeftTopSize(
          { left: bounds.left, top: bounds.top, width: maxW, height: h },
          { persist: true },
        );
        return;
      }

      if (command === "tile_bottom") {
        saveRestore();
        const h = Math.floor((maxH - WINDOW_MARGIN) / 2);
        applyLeftTopSize(
          { left: bounds.left, top: bounds.bottom - h, width: maxW, height: h },
          { persist: true },
        );
        return;
      }

      // Fallback: keep current.
      applyLeftTopSize({ left: curLeft, top: curTop, width: currentSize.width, height: currentSize.height }, { persist: true });
    },
    [applyLeftTopSize, isDraggable, storageKey],
  );

  useEffect(() => {
    if (!storageKey) return;
    const onCmd = (e: Event) => {
      const detail = (e as CustomEvent<{ storageKey?: string; command?: WindowCommand }>).detail;
      if (!detail?.storageKey || detail.storageKey !== storageKey) return;
      const command = detail.command;
      if (!command) return;
      onWindowCommand(command);
    };
    window.addEventListener("openclaw:window-command", onCmd);
    return () => window.removeEventListener("openclaw:window-command", onCmd);
  }, [onWindowCommand, storageKey]);

  useEffect(() => {
    if (!isDraggable) return;

    const clampToViewport = () => {
      const size = windowSizeRef.current;
      if (!size) return;
      const { left, top } = toLeftTopFromDragOffset(size, dragOffsetRef.current);
      applyLeftTopSize({ left, top, width: size.width, height: size.height }, { persist: true });
    };

    const id = window.setTimeout(clampToViewport, 0);
    window.addEventListener("resize", clampToViewport);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", clampToViewport);
    };
  }, [applyLeftTopSize, isDraggable]);

  return (
    <div
      ref={windowRef}
      className={[chromeClassName, isHidden ? "pointer-events-none opacity-0" : "opacity-100"].join(
        " ",
      )}
      style={{
        zIndex,
        width: windowSize?.width,
        height: windowSize?.height,
        transform: `translate(-50%, -50%) translate(${dragOffset.dx}px, ${
          dragOffset.dy + translateY
        }px) scale(${scale})`,
      }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={() => onFocus()}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.72),transparent_72%)]" />
      <div
        className="relative flex items-center justify-between border-b border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(241,245,249,0.88)_100%)] px-4 py-3 select-none touch-none"
        onPointerDown={onTitleBarPointerDown}
        onPointerMove={onTitleBarPointerMove}
        onPointerUp={onTitleBarPointerUp}
        onPointerCancel={onTitleBarPointerUp}
        onDoubleClick={onDoubleClickTitleBar}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ff5f57] shadow-sm ring-1 ring-black/8 transition-transform hover:scale-105"
            aria-label="关闭"
            title="关闭"
          >
            <X className="h-2.5 w-2.5 text-black/50 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onMinimize();
            }}
            className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#ffbd2f] shadow-sm ring-1 ring-black/8 transition-transform hover:scale-105"
            aria-label="最小化"
            title="最小化"
          >
            <Minus className="h-2.5 w-2.5 text-black/50 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <span className="flex h-3.5 w-3.5 rounded-full bg-[#28c840] shadow-sm ring-1 ring-black/8" />
        </div>

        <div className="absolute left-1/2 flex min-w-0 max-w-[60%] -translate-x-1/2 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]">
            <Icon className="h-4 w-4 text-slate-700" />
          </span>
          <span className="truncate text-sm font-semibold text-slate-800">{title}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-slate-200 bg-white/75 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Workspace App
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.86)_0%,rgba(255,255,255,0.94)_100%)]">
        {children}
      </div>

      {isDraggable && (
        <div
          className="absolute inset-0 pointer-events-none"
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        >
          {/* corners */}
          <div
            className="absolute left-0 top-0 h-4 w-4 cursor-nwse-resize pointer-events-auto"
            onPointerDown={startResize("nw")}
          />
          <div
            className="absolute right-0 top-0 h-4 w-4 cursor-nesw-resize pointer-events-auto"
            onPointerDown={startResize("ne")}
          />
          <div
            className="absolute left-0 bottom-0 h-4 w-4 cursor-nesw-resize pointer-events-auto"
            onPointerDown={startResize("sw")}
          />
          <div
            className="absolute right-0 bottom-0 h-4 w-4 cursor-nwse-resize pointer-events-auto"
            onPointerDown={startResize("se")}
          />

          {/* edges */}
          <div
            className="absolute left-0 top-4 bottom-4 w-2 cursor-ew-resize pointer-events-auto"
            onPointerDown={startResize("w")}
          />
          <div
            className="absolute right-0 top-4 bottom-4 w-2 cursor-ew-resize pointer-events-auto"
            onPointerDown={startResize("e")}
          />
          <div
            className="absolute top-0 left-4 right-4 h-2 cursor-ns-resize pointer-events-auto"
            onPointerDown={startResize("n")}
          />
          <div
            className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize pointer-events-auto"
            onPointerDown={startResize("s")}
          />
        </div>
      )}
    </div>
  );
}
