/**
 * 공개 홈페이지 팝업/공지 배너 표시 레이어
 * - modal 팝업은 우측 고정형 슬라이드 팝업으로 표시합니다.
 * - 동일한 노출 묶음은 자동 슬라이드되며 버튼 클릭 시 링크 이동 후 팝업을 닫습니다.
 * - 오늘 하루 보지 않기는 브라우저 localStorage에 저장합니다.
 */

import { useEffect, useMemo, useState } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";
import { trpc } from "@/lib/trpc";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
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

function PopupActionButton({
  popup,
  onClose,
}: {
  popup: Popup;
  onClose: () => void;
}) {
  if (!popup.linkLabel || !popup.linkHref) return null;

  return (
    <a
      href={popup.linkHref}
      onClick={onClose}
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
  const [modalIndex, setModalIndex] = useState(0);

  const { data: popups = [] } = trpc.home.popups.useQuery(undefined, {
    enabled: !isAdminRoute,
    staleTime: 60 * 1000,
  });

  const visiblePopups = useMemo(() => {
    if (isAdminRoute) return [];
    return popups.filter((popup) => !closedIds.includes(popup.id) && !isDismissed(popup));
  }, [closedIds, isAdminRoute, popups]);

  const modalPopups = useMemo(
    () => visiblePopups.filter((popup) => popup.placement === "modal"),
    [visiblePopups],
  );
  const topBannerPopup = useMemo(
    () => visiblePopups.find((popup) => popup.placement === "top_banner") ?? null,
    [visiblePopups],
  );
  const bottomSheetPopup = useMemo(
    () => visiblePopups.find((popup) => popup.placement === "bottom_sheet") ?? null,
    [visiblePopups],
  );

  useEffect(() => {
    if (modalPopups.length === 0) {
      setModalIndex(0);
      return;
    }
    if (modalIndex >= modalPopups.length) {
      setModalIndex(0);
    }
  }, [modalIndex, modalPopups.length]);

  useEffect(() => {
    if (modalPopups.length <= 1) return;
    const timer = window.setInterval(() => {
      setModalIndex((prev) => (prev + 1) % modalPopups.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [modalPopups.length]);

  if (!topBannerPopup && !bottomSheetPopup && modalPopups.length === 0) {
    return null;
  }

  const closePopup = (popupId: number) => {
    setClosedIds((prev) => (prev.includes(popupId) ? prev : [...prev, popupId]));
  };

  const dismissPopup = (popup: Popup) => {
    if (typeof window !== "undefined") {
      const hours = Math.max(1, popup.dismissPeriodHours || 24);
      window.localStorage.setItem(
        getDismissStorageKey(popup.id),
        String(Date.now() + hours * 60 * 60 * 1000),
      );
    }
    closePopup(popup.id);
  };

  const activeModalPopup = modalPopups[modalIndex] ?? null;
  const canSlide = modalPopups.length > 1;

  const moveSlide = (direction: "prev" | "next") => {
    if (modalPopups.length <= 1) return;
    setModalIndex((prev) =>
      direction === "prev"
        ? (prev - 1 + modalPopups.length) % modalPopups.length
        : (prev + 1) % modalPopups.length,
    );
  };

  return (
    <>
      {topBannerPopup && (
        <div className="fixed inset-x-0 top-0 z-[300] border-b border-[#1B5E20]/20 bg-white shadow-lg">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900">{topBannerPopup.title}</p>
              {topBannerPopup.content && (
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{topBannerPopup.content}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PopupActionButton popup={topBannerPopup} onClose={() => closePopup(topBannerPopup.id)} />
              {topBannerPopup.isDismissible && (
                <button
                  type="button"
                  onClick={() => dismissPopup(topBannerPopup)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
                >
                  오늘 하루 보지 않기
                </button>
              )}
              <button
                type="button"
                onClick={() => closePopup(topBannerPopup.id)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="팝업 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {bottomSheetPopup && (
        <div className="fixed inset-x-0 bottom-0 z-[300] px-3 pb-3">
          <div className="mx-auto max-w-md rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-bold text-gray-900">{bottomSheetPopup.title}</p>
                {bottomSheetPopup.content && (
                  <p className="mt-2 text-sm leading-relaxed text-gray-600">{bottomSheetPopup.content}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => closePopup(bottomSheetPopup.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="팝업 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {bottomSheetPopup.imageUrl && (
              <img
                src={bottomSheetPopup.imageUrl}
                alt=""
                className="mt-3 max-h-44 w-full rounded-xl object-cover"
                loading="lazy"
              />
            )}
            <div className="mt-4 flex flex-col gap-2">
              <PopupActionButton popup={bottomSheetPopup} onClose={() => closePopup(bottomSheetPopup.id)} />
              {bottomSheetPopup.isDismissible && (
                <button
                  type="button"
                  onClick={() => dismissPopup(bottomSheetPopup)}
                  className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  오늘 하루 보지 않기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeModalPopup && (
        <div className="fixed inset-x-4 bottom-4 z-[320] md:inset-x-auto md:bottom-auto md:right-6 md:top-1/2 md:w-[440px] md:-translate-y-1/2">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`notice-popup-title-${activeModalPopup.id}`}
            className="relative overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-2xl"
          >
            <button
              type="button"
              onClick={() => closePopup(activeModalPopup.id)}
              className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow hover:bg-white hover:text-gray-800"
              aria-label="팝업 닫기"
            >
              <X className="h-4 w-4" />
            </button>

            {activeModalPopup.imageUrl && (
              <img
                src={activeModalPopup.imageUrl}
                alt=""
                className="h-56 w-full object-cover md:h-64"
                loading="lazy"
              />
            )}

            <div className="p-5 md:p-6">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2
                    id={`notice-popup-title-${activeModalPopup.id}`}
                    className="pr-8 text-xl font-bold text-gray-900 md:text-2xl"
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    {activeModalPopup.title}
                  </h2>
                  <p className="mt-1 text-xs text-gray-400">
                    {modalIndex + 1} / {modalPopups.length}
                  </p>
                </div>

                {canSlide && (
                  <div className="mt-1 hidden items-center gap-1 md:flex">
                    <button
                      type="button"
                      onClick={() => moveSlide("prev")}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      aria-label="이전 팝업"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide("next")}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      aria-label="다음 팝업"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <PopupActionButton popup={activeModalPopup} onClose={() => closePopup(activeModalPopup.id)} />
                {activeModalPopup.isDismissible && (
                  <button
                    type="button"
                    onClick={() => dismissPopup(activeModalPopup)}
                    className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                  >
                    오늘 하루 보지 않기
                  </button>
                )}
              </div>

              {canSlide && (
                <div className="mt-4">
                  <div className="flex items-center justify-center gap-2 md:hidden">
                    <button
                      type="button"
                      onClick={() => moveSlide("prev")}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      aria-label="이전 팝업"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlide("next")}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                      aria-label="다음 팝업"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-center gap-2">
                    {modalPopups.map((popup, index) => (
                      <button
                        key={popup.id}
                        type="button"
                        onClick={() => setModalIndex(index)}
                        className={`h-2.5 rounded-full transition-all ${
                          modalIndex === index ? "w-7 bg-[#1B5E20]" : "w-2.5 bg-gray-300"
                        }`}
                        aria-label={`${index + 1}번 팝업 보기`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
