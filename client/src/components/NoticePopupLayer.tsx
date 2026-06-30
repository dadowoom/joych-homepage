/**
 * 공개 홈페이지 팝업/공지 배너 표시 레이어
 * - home.popups API에서 현재 노출 가능한 팝업만 받아 표시합니다.
 * - "오늘 하루 보지 않기"는 브라우저 localStorage에 저장합니다.
 */

import { useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { X } from "lucide-react";
import { useLocation } from "wouter";

type Popup = inferRouterOutputs<AppRouter>["home"]["popups"][number];

function getDismissStorageKey(id: number) {
  return `joych_notice_popup_dismissed_until_${id}`;
}

function isDismissed(popup: Popup) {
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem(getDismissStorageKey(popup.id));
  if (!value) return false;
  const dismissedUntil = Number(value);
  if (!Number.isFinite(dismissedUntil)) return false;
  return Date.now() < dismissedUntil;
}

function PopupLink({ popup }: { popup: Popup }) {
  if (!popup.linkLabel || !popup.linkHref) return null;
  return (
    <a
      href={popup.linkHref}
      className="inline-flex items-center justify-center rounded-lg bg-[#1B5E20] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2E7D32]"
    >
      {popup.linkLabel}
    </a>
  );
}

export default function NoticePopupLayer() {
  const [location] = useLocation();
  const isAdminRoute = location === "/admin" || location.startsWith("/admin_joych_2026");
  const [closedIds, setClosedIds] = useState<number[]>([]);

  const { data: popups = [] } = trpc.home.popups.useQuery(undefined, {
    enabled: !isAdminRoute,
    staleTime: 60 * 1000,
  });

  const activePopup = useMemo(() => {
    if (isAdminRoute) return null;
    return popups.find((popup) => !closedIds.includes(popup.id) && !isDismissed(popup)) ?? null;
  }, [closedIds, isAdminRoute, popups]);

  if (!activePopup) return null;

  const close = () => {
    setClosedIds((prev) => (prev.includes(activePopup.id) ? prev : [...prev, activePopup.id]));
  };

  const dismiss = () => {
    if (typeof window !== "undefined") {
      const hours = Math.max(1, activePopup.dismissPeriodHours || 24);
      window.localStorage.setItem(
        getDismissStorageKey(activePopup.id),
        String(Date.now() + hours * 60 * 60 * 1000)
      );
    }
    close();
  };

  if (activePopup.placement === "top_banner") {
    return (
      <div className="fixed inset-x-0 top-0 z-[300] border-b border-[#1B5E20]/20 bg-white shadow-lg">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{activePopup.title}</p>
            {activePopup.content && (
              <p className="mt-1 line-clamp-2 text-sm text-gray-600">{activePopup.content}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <PopupLink popup={activePopup} />
            {activePopup.isDismissible && (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
              >
                오늘 하루 보지 않기
              </button>
            )}
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="팝업 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activePopup.placement === "bottom_sheet") {
    return (
      <div className="fixed inset-x-0 bottom-0 z-[300] px-3 pb-3">
        <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-gray-900">{activePopup.title}</p>
              {activePopup.content && (
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{activePopup.content}</p>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              aria-label="팝업 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {activePopup.imageUrl && (
            <img
              src={activePopup.imageUrl}
              alt=""
              className="mt-3 max-h-44 w-full rounded-xl object-cover"
             loading="lazy"/>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <PopupLink popup={activePopup} />
            {activePopup.isDismissible && (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                오늘 하루 보지 않기
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`notice-popup-title-${activePopup.id}`}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow hover:bg-white hover:text-gray-800"
          aria-label="팝업 닫기"
        >
          <X className="h-4 w-4" />
        </button>
        {activePopup.imageUrl && (
          <img
            src={activePopup.imageUrl}
            alt=""
            className="max-h-64 w-full object-cover"
           loading="lazy"/>
        )}
        <div className="p-6">
          <h2
            id={`notice-popup-title-${activePopup.id}`}
            className="pr-8 text-xl font-bold text-gray-900"
            style={{ fontFamily: "'Noto Serif KR', serif" }}
          >
            {activePopup.title}
          </h2>
          {activePopup.content && (
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-gray-600">
              {activePopup.content}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
            <PopupLink popup={activePopup} />
            {activePopup.isDismissible && (
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
              >
                오늘 하루 보지 않기
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
