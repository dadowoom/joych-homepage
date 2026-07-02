import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Share2, Smartphone } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIosDevice() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isAndroidDevice() {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

export default function PwaInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  const device = useMemo(() => ({
    ios: isIosDevice(),
    android: isAndroidDevice(),
  }), []);

  useEffect(() => {
    setIsStandalone(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsStandalone(true);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      setShowGuide(true);
      return;
    }

    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsStandalone(true);
      }
      setInstallPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  if (isStandalone) {
    return (
      <section className="bg-[#F1F8E9]">
        <div className="container py-4">
          <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-white px-4 py-3 text-sm text-[#1B5E20] shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span className="font-semibold">홈 화면 앱으로 실행 중입니다.</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-[#F7F7F5]">
      <div className="container py-5">
        <div className="rounded-2xl border border-green-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E8F5E9] text-[#1B5E20]">
                <Smartphone className="h-6 w-6" />
              </span>
              <div>
                <p className="text-base font-bold text-gray-900">기쁨의교회 바로가기 만들기</p>
                <p className="mt-1 text-sm leading-6 text-gray-500">
                  휴대폰 홈 화면에 추가하면 앱처럼 바로 열 수 있고, 알림도 더 쉽게 받을 수 있습니다.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2E7D32] disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {installing ? "확인 중" : installPrompt ? "홈 화면에 추가" : "추가 방법 보기"}
              </button>
              <button
                type="button"
                onClick={() => setShowGuide((prev) => !prev)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                <Share2 className="h-4 w-4" />
                안내 보기
              </button>
            </div>
          </div>

          {(showGuide || device.ios || (!installPrompt && device.android)) && (
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-2">
              <div className="rounded-xl bg-[#F8FAF8] p-4">
                <p className="text-sm font-bold text-gray-900">아이폰</p>
                <ol className="mt-2 space-y-1 text-sm leading-6 text-gray-600">
                  <li>1. Safari로 홈페이지를 엽니다.</li>
                  <li>2. 아래 공유 버튼을 누릅니다.</li>
                  <li>3. 홈 화면에 추가를 누릅니다.</li>
                </ol>
              </div>
              <div className="rounded-xl bg-[#F8FAF8] p-4">
                <p className="text-sm font-bold text-gray-900">안드로이드</p>
                <ol className="mt-2 space-y-1 text-sm leading-6 text-gray-600">
                  <li>1. Chrome으로 홈페이지를 엽니다.</li>
                  <li>2. 홈 화면에 추가 버튼을 누릅니다.</li>
                  <li>3. 설치 또는 추가를 확인합니다.</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
