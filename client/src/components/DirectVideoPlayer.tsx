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

const APP_MEDIA_HOSTNAMES = new Set([
  "newjoych.co.kr",
  "www.newjoych.co.kr",
  "joych.org",
  "www.joych.org",
  "m.joych.org",
]);
const MEDIA_ERROR_DECODE = 3;

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
    ? `/api/direct-video${url.pathname}`
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

export function getPlayableSrc(src: string) {
  if (typeof window === "undefined") return src;

  try {
    const url = new URL(normalizeSource(src), window.location.origin);
    const proxiedSrc = getSermonVideoProxySrc(url);
    if (proxiedSrc) {
      // Keep sermon files on a same-origin .mp4 URL. iOS video playback is
      // less forgiving with query-string proxy URLs than ordinary page fetches.
      return new URL(proxiedSrc, window.location.origin).toString();
    }

    const isKnownAppMediaPath =
      APP_MEDIA_HOSTNAMES.has(url.hostname) &&
      /^\/api\/(?:legacy-vod|direct-video(?:-proxy)?)(?:\/|$)/.test(url.pathname);
    if (isKnownAppMediaPath) {
      // Saved media URLs may still contain the former newjoych.co.kr host.
      // Always use the domain the visitor is currently on so CORP/same-origin
      // rules cannot block playback after the public-domain transition.
      return `${url.pathname}${url.search}${url.hash}`;
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

function isLegacyVideoSource(src: string) {
  try {
    const path = new URL(src, window.location.origin).pathname;
    return /^\/api\/legacy-vod\/\d+\/\d+\/\d+\.mp4$/.test(path);
  } catch {
    return false;
  }
}

function isExternalPlaybackSource(src: string) {
  try {
    return new URL(src, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export default function DirectVideoPlayer({ src, title, className }: DirectVideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const [mediaErrorCode, setMediaErrorCode] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const playableSrc = useMemo(() => getPlayableSrc(src), [src]);
  const videoType = useMemo(() => getVideoType(playableSrc), [playableSrc]);
  const isLegacySource = useMemo(() => isLegacyVideoSource(playableSrc), [playableSrc]);
  const isExternalSource = useMemo(() => isExternalPlaybackSource(playableSrc), [playableSrc]);

  useEffect(() => {
    setHasError(false);
    setMediaErrorCode(null);
  }, [src]);

  const handleError = useCallback(() => {
    setHasError(true);
    setMediaErrorCode(videoRef.current?.error?.code ?? null);
  }, []);

  const retryPlayback = useCallback(() => {
    setHasError(false);
    setMediaErrorCode(null);
    videoRef.current?.load();
  }, []);

  const isDecodeError = mediaErrorCode === MEDIA_ERROR_DECODE;
  const errorTitle = isDecodeError
    ? "이 휴대폰에서 지원하지 않는 영상 형식입니다."
    : isLegacySource
      ? "이 옛 영상은 원본 MP4를 찾지 못했습니다."
      : "영상 재생에 문제가 있습니다.";
  const errorDescription = isDecodeError
    ? "PC에서 확인하거나 모바일 호환용 영상으로 다시 제작해야 재생할 수 있습니다."
    : isLegacySource
      ? "복구 가능한 옛 영상은 자동 연결했습니다. 이 영상은 교회가 원본 파일을 확인해 다시 등록해야 합니다."
      : "잠시 후 다시 시도하거나 영상 파일을 직접 열어주세요.";

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
          setMediaErrorCode(null);
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
            {isLegacySource ? (
              <button
                type="button"
                onClick={retryPlayback}
                className="mt-3 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#1B5E20]"
              >
                다시 시도
              </button>
            ) : (
              <a
                href={playableSrc}
                target={isExternalSource ? "_blank" : undefined}
                rel={isExternalSource ? "noreferrer" : undefined}
                className="mt-3 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#1B5E20]"
              >
                영상 직접 열기
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
