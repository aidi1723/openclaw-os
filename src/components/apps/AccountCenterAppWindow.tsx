"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Globe,
  Mail,
  MessageCircle,
  Settings2,
  Shield,
  Smartphone,
} from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { getPublishConfig, refreshPublishConfig, subscribePublishConfig } from "@/lib/publish-config";
import { requestOpenSettings } from "@/lib/ui-events";

type CategoryId = "social" | "cms" | "comms";

type PlatformCard = {
  id: string;
  name: string;
  category: CategoryId;
  logo: { kind: "icon"; icon: React.ReactNode; bgClassName: string };
  status: "authorized" | "needs_update";
  description?: string;
  actionLabel?: string;
  opensSettings?: boolean;
};

const categories: Array<{ id: CategoryId; name: string; icon: React.ReactNode }> =
  [
    { id: "social", name: "社交媒体", icon: <Smartphone className="h-4 w-4" /> },
    { id: "cms", name: "独立站与 CMS", icon: <Globe className="h-4 w-4" /> },
    { id: "comms", name: "邮件与通讯", icon: <Mail className="h-4 w-4" /> },
  ];

const statusLabel: Record<PlatformCard["status"], { dot: string; text: string }> =
  {
    authorized: { dot: "🟢", text: "已授权" },
    needs_update: { dot: "🔴", text: "需更新" },
  };

export function AccountCenterAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("social");
  const [configVersion, setConfigVersion] = useState(0);
  const { toast, showToast } = useTimedToast(2000);

  useEffect(() => {
    void refreshPublishConfig();
    const sync = () => setConfigVersion((v) => v + 1);
    const unsubscribe = subscribePublishConfig(sync);
    return () => {
      unsubscribe();
    };
  }, []);

  const cards: PlatformCard[] = useMemo(
    () => {
      void configVersion;
      const matrix = getPublishConfig();
      const socialCards: PlatformCard[] = [
        {
          id: "xiaohongshu",
          name: "小红书",
          category: "social",
          status:
            matrix.xiaohongshu.token.trim() || matrix.xiaohongshu.webhookUrl.trim()
              ? "authorized"
              : "needs_update",
          description:
            matrix.xiaohongshu.webhookUrl.trim()
              ? "Token + Webhook 已配置"
              : matrix.xiaohongshu.token.trim()
                ? "已配置 Token，尚未设置 Webhook"
                : "尚未配置 Token / Webhook",
          actionLabel: "去设置",
          opensSettings: true,
          logo: {
            kind: "icon",
            icon: <Shield className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-rose-500 to-pink-500",
          },
        },
        {
          id: "douyin",
          name: "抖音",
          category: "social",
          status:
            matrix.douyin.token.trim() || matrix.douyin.webhookUrl.trim()
              ? "authorized"
              : "needs_update",
          description:
            matrix.douyin.webhookUrl.trim()
              ? "Token + Webhook 已配置"
              : matrix.douyin.token.trim()
                ? "已配置 Token，尚未设置 Webhook"
                : "尚未配置 Token / Webhook",
          actionLabel: "去设置",
          opensSettings: true,
          logo: {
            kind: "icon",
            icon: <MessageCircle className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-slate-900 to-slate-700",
          },
        },
        {
          id: "instagram",
          name: "Instagram",
          category: "social",
          status:
            matrix.instagram.token.trim() || matrix.instagram.webhookUrl.trim()
              ? "authorized"
              : "needs_update",
          description:
            matrix.instagram.webhookUrl.trim()
              ? "Token + Webhook 已配置"
              : matrix.instagram.token.trim()
                ? "已配置 Token，尚未设置 Webhook"
                : "尚未配置 Token / Webhook",
          actionLabel: "去设置",
          opensSettings: true,
          logo: {
            kind: "icon",
            icon: <Smartphone className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-fuchsia-500 to-orange-500",
          },
        },
        {
          id: "tiktok",
          name: "TikTok",
          category: "social",
          status:
            matrix.tiktok.token.trim() || matrix.tiktok.webhookUrl.trim()
              ? "authorized"
              : "needs_update",
          description:
            matrix.tiktok.webhookUrl.trim()
              ? "Token + Webhook 已配置"
              : matrix.tiktok.token.trim()
                ? "已配置 Token，尚未设置 Webhook"
                : "尚未配置 Token / Webhook",
          actionLabel: "去设置",
          opensSettings: true,
          logo: {
            kind: "icon",
            icon: <MessageCircle className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-black to-cyan-500",
          },
        },
      ];

      return [
        ...socialCards,
        {
          id: "storefront",
          name: "独立站 / Storefront",
          category: "cms",
          status:
            matrix.storefront.token.trim() || matrix.storefront.webhookUrl.trim()
              ? "authorized"
              : "needs_update",
          description:
            matrix.storefront.webhookUrl.trim()
              ? "API Token + Webhook 已配置"
              : matrix.storefront.token.trim()
                ? "已配置 API Token，尚未设置 Webhook"
                : "尚未配置 API Token / Webhook",
          actionLabel: "去设置",
          opensSettings: true,
          logo: {
            kind: "icon",
            icon: <Building2 className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-amber-500 to-orange-500",
          },
        },
        {
          id: "cms_generic",
          name: "CMS（通用）",
          category: "cms",
          status: "needs_update",
          description: "示例占位，后续可接入通用 CMS token/webhook 流程",
          actionLabel: "待接入",
          opensSettings: false,
          logo: {
            kind: "icon",
            icon: <Globe className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-sky-500 to-indigo-500",
          },
        },
        {
          id: "gmail",
          name: "Gmail",
          category: "comms",
          status: "needs_update",
          description: "演示占位，后续可接入邮件触发 / 自动回复",
          actionLabel: "待接入",
          opensSettings: false,
          logo: {
            kind: "icon",
            icon: <Mail className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-emerald-500 to-teal-500",
          },
        },
        {
          id: "wechat_work",
          name: "企业微信",
          category: "comms",
          status: "needs_update",
          description: "演示占位，后续可接入通知 / 机器人 / 群发",
          actionLabel: "待接入",
          opensSettings: false,
          logo: {
            kind: "icon",
            icon: <Settings2 className="h-5 w-5 text-white" />,
            bgClassName: "bg-gradient-to-br from-blue-600 to-cyan-500",
          },
        },
      ];
    },
    [configVersion],
  );

  const filtered = useMemo(
    () => cards.filter((c) => c.category === activeCategory && c.opensSettings),
    [cards, activeCategory],
  );

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="矩阵授权中心"
      icon={Shield}
      widthClassName="w-[980px]"
      storageKey="openclaw.window.account_center"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="flex min-h-[560px] flex-col lg:flex-row">
          {/* Left menu */}
          <aside className="w-full border-b border-gray-200 bg-gray-50/60 lg:w-60 lg:shrink-0 lg:border-b-0 lg:border-r">
            <div className="p-5">
              <div className="text-xs font-semibold text-gray-500">
                Account Center
              </div>
              <div className="mt-1 text-lg font-bold text-gray-900">矩阵授权</div>
              <div className="mt-2 text-xs text-gray-500">
                统一管理各平台 Token / OAuth 状态
              </div>
            </div>

            <nav className="grid grid-cols-1 gap-1 px-2 pb-4 sm:grid-cols-2 lg:grid-cols-1">
              {categories.map((cat) => {
                const active = cat.id === activeCategory;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                      active
                        ? "bg-white border border-gray-200 text-gray-900 shadow-sm"
                        : "text-gray-700 hover:bg-white/70",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        "h-9 w-9 rounded-xl flex items-center justify-center border",
                        active ? "bg-blue-50 border-blue-100" : "bg-white border-gray-200",
                      ].join(" ")}
                    >
                      {cat.icon}
                    </span>
                    <span className="truncate">{cat.name}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Right grid */}
          <main className="flex-1 p-4 sm:p-6">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-lg font-bold text-gray-900">
                  {categories.find((c) => c.id === activeCategory)?.name}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  这里只保留已经接入企业授权路径的平台。
                </div>
              </div>
              <div className="text-xs text-gray-500">
                共 {filtered.length} 个平台
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((card) => {
                const s = statusLabel[card.status];
                return (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={[
                            "h-12 w-12 rounded-2xl flex items-center justify-center shadow",
                            card.logo.bgClassName,
                          ].join(" ")}
                        >
                          {card.logo.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {card.name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {card.description ?? "授权与权限配置"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs font-semibold text-gray-700 shrink-0">
                        {s.dot} {s.text}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">
                        最近更新：—
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (card.opensSettings) {
                            requestOpenSettings("matrix");
                            showToast(`请在设置中配置 ${card.name}`, "ok");
                            return;
                          }
                          showToast(`${card.name} 授权流程待接入`, "error");
                        }}
                        className="px-3 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors"
                      >
                        {card.actionLabel ?? "配置/修改"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}
