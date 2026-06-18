import { useEffect, useMemo, useState } from "react";
import { useParams } from "wouter";
import DirectVideoPlayer from "@/components/DirectVideoPlayer";
import SubPageLayout from "@/components/SubPageLayout";

type LegacyVodInfo = {
  subject: string;
  word: string;
  preacher: string;
  date: string;
  streamUrl: string;
  originalPageUrl: string;
};

function isNumericId(value: string | undefined) {
  return Boolean(value && /^\d{1,10}$/.test(value));
}

export default function LegacyVodPage() {
  const { pageCode, num, vodType } = useParams<{
    pageCode: string;
    num: string;
    vodType: string;
  }>();
  const [info, setInfo] = useState<LegacyVodInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isValid = isNumericId(pageCode) && isNumericId(num) && isNumericId(vodType);
  const streamUrl = useMemo(() => {
    if (!isValid) return "";
    return `/api/legacy-vod/${pageCode}/${num}/${vodType}.mp4`;
  }, [isValid, num, pageCode, vodType]);

  useEffect(() => {
    if (!isValid) {
      setIsLoading(false);
      setError("영상 주소가 올바르지 않습니다.");
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    fetch(`/api/legacy-vod/${pageCode}/${num}/${vodType}/info`, {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then(async response => {
        if (!response.ok) throw new Error("영상 정보를 불러오지 못했습니다.");
        return response.json() as Promise<LegacyVodInfo>;
      })
      .then(data => setInfo(data))
      .catch(err => {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "영상 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [isValid, num, pageCode, vodType]);

  const pageTitle = info?.subject || "예배 영상";

  return (
    <SubPageLayout pageTitle={pageTitle} parentLabel="조이풀TV">
      <div className="max-w-4xl">
        {isLoading ? (
          <div className="min-h-[320px] flex items-center justify-center rounded-lg border border-gray-100 bg-white">
            <div className="text-center text-gray-400">
              <div className="w-10 h-10 border-4 border-[#1B5E20] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm">영상을 불러오는 중입니다.</p>
            </div>
          </div>
        ) : error ? (
          <div className="min-h-[320px] flex items-center justify-center rounded-lg border border-gray-100 bg-white">
            <div className="text-center text-gray-500 px-6">
              <i className="fas fa-video-slash text-4xl text-gray-300 mb-4"></i>
              <p className="text-base font-semibold text-gray-700">{error}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="relative overflow-hidden rounded-lg bg-black shadow-sm">
              <DirectVideoPlayer
                src={info?.streamUrl || streamUrl}
                title={pageTitle}
                className="block w-full aspect-video bg-black"
              />
            </div>
            <div className="mt-5 border-t border-gray-200 pt-4 text-sm text-gray-600">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{pageTitle}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {info?.preacher && <span>설교자: {info.preacher}</span>}
                {info?.word && <span>본문: {info.word}</span>}
                {info?.date && <span>날짜: {info.date}</span>}
              </div>
              {info?.originalPageUrl && (
                <a
                  href={info.originalPageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-4 text-[#1B5E20] hover:underline"
                >
                  원본 페이지 보기
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </SubPageLayout>
  );
}
