import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download, Share2, Smartphone } from "lucide-react";

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
  const [open, setOpen] = useState(false);

  const device = useMemo(
    () => ({
      ios: isIosDevice(),
      android: isAndroidDevice(),
    }),
    [],
  );

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
      setOpen(true);
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

  if (isStandalone || (!device.ios && !device.android && !installPrompt)) return null;

  return (
    <section className="bg-[#F7F7F5] md:hidden">
      <div className="container py-4">
        <div className="overflow-hidden rounded-xl border border-green-100 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-[#1B5E20]">
              <Smartphone className="h-4 w-4" />
              홈화면 추가
            </span>
            {open ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </button>

          {open && (
            <div className="border-t border-green-50 px-4 pb-4 pt-3">
              <p className="text-sm font-semibold text-gray-900">기쁨의교회를 앱처럼 바로 열 수 있습니다.</p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                휴대폰 홈 화면에 추가하면 주소를 다시 입력하지 않고 바로 접속할 수 있고, 알림 설정도 더 쉽게 사용할 수 있습니다.
              </p>

              <button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#1B5E20] px-4 py-2 text-sm font-bold text-white transition-colors active:bg-[#2E7D32] disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {installing ? "확인 중" : installPrompt ? "홈 화면에 추가" : "추가 방법 보기"}
              </button>

              <div className="mt-3 grid gap-2">
                <div className="rounded-lg bg-[#F8FAF8] p-3">
                  <p className="flex items-center gap-1 text-xs font-bold text-gray-900">
                    <Share2 className="h-3.5 w-3.5" />
                    iPhone
                  </p>
                  <ol className="mt-1 space-y-0.5 text-xs leading-5 text-gray-600">
                    <li>1. Safari로 홈페이지를 엽니다.</li>
                    <li>2. 하단 공유 버튼을 누릅니다.</li>
                    <li>3. 홈 화면에 추가를 선택합니다.</li>
                  </ol>
                </div>
                <div className="rounded-lg bg-[#F8FAF8] p-3">
                  <p className="text-xs font-bold text-gray-900">Android</p>
                  <ol className="mt-1 space-y-0.5 text-xs leading-5 text-gray-600">
                    <li>1. Chrome으로 홈페이지를 엽니다.</li>
                    <li>2. 홈 화면에 추가 버튼을 누릅니다.</li>
                    <li>3. 설치 또는 추가를 확인합니다.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
