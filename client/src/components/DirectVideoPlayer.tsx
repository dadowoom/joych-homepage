import { useEffect, useMemo, useState, type VideoHTMLAttributes } from "react";

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

function getPlayableSrc(src: string) {
  if (typeof window === "undefined") return src;

  try {
    const url = new URL(src, window.location.origin);
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

export default function DirectVideoPlayer({ src, title, className }: DirectVideoPlayerProps) {
  const [hasError, setHasError] = useState(false);
  const playableSrc = useMemo(() => getPlayableSrc(src), [src]);
  const videoType = useMemo(() => getVideoType(playableSrc), [playableSrc]);

  useEffect(() => {
    setHasError(false);
  }, [playableSrc]);

  return (
    <>
      <video
        key={playableSrc}
        className={className}
        controls
        preload="metadata"
        aria-label={title}
        onError={() => setHasError(true)}
        onLoadedMetadata={() => setHasError(false)}
        {...inlinePlaybackAttrs}
      >
        <source src={playableSrc} type={videoType} />
      </video>
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/80 px-5 text-center text-white">
          <div>
            <p className="text-sm font-semibold">모바일 브라우저에서 영상 재생이 지연되고 있습니다.</p>
            <a
              href={playableSrc}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-md bg-white px-4 py-2 text-sm font-semibold text-[#1B5E20]"
            >
              새 창에서 영상 열기
            </a>
          </div>
        </div>
      )}
    </>
  );
}
