import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type VideoHTMLAttributes,
} from "react";

type DirectVideoPlayerProps = {
  src: string;
  title: string;
  className?: string;
};

const inlinePlaybackAttrs = {
  playsInline: true,
  "webkit-playsinline": "true",
} as VideoHTMLAttributes<HTMLVideoElement> & { "webkit-playsinline": string };

function stripWww(hostname: string) {
  return hostname.replace(/^www\./, "");
}

function getSermonVideoProxySrc(url: URL) {
  const isAllowedHttpMp4 =
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.hostname === "sermon.joych.org" &&
    url.pathname.startsWith("/mp4/") &&
    url.pathname.toLowerCase().endsWith(".mp4");

  return isAllowedHttpMp4
    ? `/api/direct-video-proxy?url=${encodeURIComponent(url.toString())}`
    : null;
}

function normalizeSource(src: string) {
  const trimmed = src.trim();
  if (!trimmed) return "";
  if (/^\/\/sermon\.joych\.org\/mp4\//.test(trimmed)) {
    return `http:${trimmed}`;
  }
  return trimmed;
}

function getPlayableSrc(src: string) {
  if (typeof window === "undefined") return src;

  try {
    const url = new URL(normalizeSource(src), window.location.origin);
    const proxiedSrc = getSermonVideoProxySrc(url);
    if (proxiedSrc) {
      // Mobile browsers stream mp4 files with Range requests, so keep direct
      // sermon files on the same-origin proxy without disabling byte ranges.
      return new URL(proxiedSrc, window.location.origin).toString();
    }

    const current = new URL(window.location.href);
    const isSameSite =
      url.protocol === current.protocol &&
      url.port === current.port &&
      stripWww(url.hostname) === stripWww(current.hostname);

    if (isSameSite) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return src;
  }

  return src;
}

function getVideoType(src: string) {
  try {
    const path = new URL(src, window.location.origin).pathname.toLowerCase();
    if (path.endsWith(".webm")) return "video/webm";
    if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
    return "video/mp4";
  } catch {
    return "video/mp4";
  }
}

function getLegacyOriginalUrl(src: string) {
  try {
    const path = new URL(src, window.location.origin).pathname;
    const match = /^\/api\/legacy-vod\/(\d+)\/(\d+)\/(\d+)\.mp4$/.exec(path);
    if (!match) return null;

    const [, pageCode, num, vodType] = match;
    return `http://www.joych.org/core/module/vod/skin_001/vodIframe.html?pageCode=${pageCode}&num=${num}&vodType=${vodType}`;
  } catch {
    return null;
  }
}

export default function DirectVideoPlayer({ src, title, className }: DirectVideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [isLegacyUnavailable, setIsLegacyUnavailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playableSrc = useMemo(() => getPlayableSrc(src), [src]);
  const videoType = useMemo(() => getVideoType(playableSrc), [playableSrc]);
  const legacyOriginalUrl = useMemo(() => getLegacyOriginalUrl(playableSrc), [playableSrc]);

  useEffect(() => {
    setHasError(false);
    setIsLegacyUnavailable(false);
  }, [src]);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLegacyUnavailable(Boolean(legacyOriginalUrl));
  }, [legacyOriginalUrl]);

  const errorTitle = isLegacyUnavailable
    ? "구형 영상 파일을 바로 재생할 수 없습니다."
    : "영상 재생에 문제가 있습니다.";
  const errorDescription = isLegacyUnavailable
    ? "이 자료는 옛 홈페이지의 WMV/MMS 형식이라 mp4 원본 확인이 필요합니다."
    : "새 창에서 열면 브라우저가 영상만 따로 다시 엽니다.";
  const errorHref = isLegacyUnavailable && legacyOriginalUrl ? legacyOriginalUrl : playableSrc;
  const errorLinkText = isLegacyUnavailable ? "옛 영상 페이지 열기" : "새 창에서 영상 열기";

  return (
    <>
      <video
        key={playableSrc}
        className={className}
        controls
        preload="metadata"
        aria-label={title}
        ref={videoRef}
        onError={handleError}
        onLoadedMetadata={() => {
          setHasError(false);
          setIsLegacyUnavailable(false);
        }}
        {...inlinePlaybackAttrs}
      >
        <source src={playableSrc} type={videoType} />
      </video>
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/80 px-5 text-center text-white">
          <div>
            <p className="text-sm font-semibold">{errorTitle}</p>
            <p className="mt-2 text-xs leading-relaxed text-white/75">{errorDescription}</p>
            <a
              href={errorHref}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#1B5E20]"
            >
              {errorLinkText}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
