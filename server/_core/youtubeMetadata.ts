import { extractYoutubeVideoId } from "./contentValidation";

const YOUTUBE_WATCH_ORIGIN = "https://www.youtube.com/watch";
const YOUTUBE_OEMBED_ORIGIN = "https://www.youtube.com/oembed";
const REQUEST_TIMEOUT_MS = 8_000;

type YoutubeOEmbedResponse = {
  title?: unknown;
  author_name?: unknown;
};

export type YoutubeVideoMetadata = {
  videoId: string;
  title: string;
  description: string | null;
  publishedDate: string | null;
  channelTitle: string | null;
  thumbnailUrl: string;
};

export class YoutubeMetadataLookupError extends Error {
  constructor(message = "유튜브 영상 정보를 가져오지 못했습니다. 공개된 영상인지와 링크를 확인해 주세요.") {
    super(message);
    this.name = "YoutubeMetadataLookupError";
  }
}

function trimText(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function decodeHtmlEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, rawName: string) => {
    const name = rawName.toLowerCase();
    if (name.startsWith("#x")) {
      const codePoint = Number.parseInt(name.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    if (name.startsWith("#")) {
      const codePoint = Number.parseInt(name.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : entity;
    }
    return namedEntities[name] ?? entity;
  });
}

function getTagAttribute(tag: string, attribute: string) {
  const match = tag.match(new RegExp(`\\b${attribute}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? decodeHtmlEntities(match[2]) : null;
}

function getMetaContent(html: string, selectors: ReadonlyArray<["name" | "property" | "itemprop", string]>) {
  const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const content = getTagAttribute(tag, "content");
    if (!content) continue;
    if (selectors.some(([attribute, value]) => getTagAttribute(tag, attribute)?.toLowerCase() === value.toLowerCase())) {
      return content;
    }
  }
  return null;
}

function getJsonStringProperty(html: string, property: string) {
  const propertyPattern = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`"${propertyPattern}":"((?:\\\\.|[^"\\\\])*)"`));
  if (!match) return null;
  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return null;
  }
}

function getPublishedDate(value: string | null) {
  const match = value?.match(/^\d{4}-\d{2}-\d{2}/);
  return match?.[0] ?? null;
}

export function extractYoutubeWatchPageMetadata(html: string) {
  const title = trimText(
    getMetaContent(html, [["itemprop", "name"], ["name", "title"], ["property", "og:title"]]) ??
      getJsonStringProperty(html, "title"),
    256
  );
  const description = trimText(
    getJsonStringProperty(html, "shortDescription") ??
      getMetaContent(html, [["name", "description"], ["property", "og:description"]]),
    10_000
  );
  const channelTitle = trimText(
    getJsonStringProperty(html, "author") ?? getMetaContent(html, [["itemprop", "author"]]),
    256
  );
  const publishedDate = getPublishedDate(
    getMetaContent(html, [["itemprop", "datePublished"]]) ??
      getJsonStringProperty(html, "publishDate") ??
      getJsonStringProperty(html, "uploadDate")
  );

  return { title, description, channelTitle, publishedDate };
}

async function fetchWithTimeout(url: string, fetchImpl: typeof fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetchImpl(url, {
      headers: {
        Accept: "text/html,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
      },
      signal: controller.signal,
    });
  } catch {
    throw new YoutubeMetadataLookupError();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches only public metadata for a verified YouTube video ID. The watch page
 * supplies the upload date and description, while oEmbed fills in a title if
 * YouTube serves a reduced watch page to the server. No user URL is fetched.
 */
export async function fetchYoutubeVideoMetadata(
  rawVideoUrlOrId: string,
  fetchImpl: typeof fetch = fetch
): Promise<YoutubeVideoMetadata> {
  const videoId = extractYoutubeVideoId(rawVideoUrlOrId);
  if (!videoId) {
    throw new YoutubeMetadataLookupError("올바른 유튜브 영상 링크를 입력해 주세요.");
  }

  const watchUrl = new URL(YOUTUBE_WATCH_ORIGIN);
  watchUrl.searchParams.set("v", videoId);
  watchUrl.searchParams.set("hl", "ko");
  watchUrl.searchParams.set("gl", "KR");
  const oembedUrl = new URL(YOUTUBE_OEMBED_ORIGIN);
  oembedUrl.searchParams.set("url", watchUrl.toString());
  oembedUrl.searchParams.set("format", "json");

  const [watchResult, oembedResult] = await Promise.allSettled([
    fetchWithTimeout(watchUrl.toString(), fetchImpl),
    fetchWithTimeout(oembedUrl.toString(), fetchImpl),
  ]);

  const watchHtml = watchResult.status === "fulfilled" && watchResult.value.ok
    ? await watchResult.value.text()
    : "";
  const pageMetadata = watchHtml ? extractYoutubeWatchPageMetadata(watchHtml) : {
    title: null,
    description: null,
    channelTitle: null,
    publishedDate: null,
  };

  let oembedMetadata: YoutubeOEmbedResponse | null = null;
  if (oembedResult.status === "fulfilled" && oembedResult.value.ok) {
    oembedMetadata = await oembedResult.value.json().catch(() => null) as YoutubeOEmbedResponse | null;
  }

  const title = pageMetadata.title ?? trimText(
    typeof oembedMetadata?.title === "string" ? oembedMetadata.title : null,
    256
  );
  if (!title) {
    throw new YoutubeMetadataLookupError();
  }

  return {
    videoId,
    title,
    description: pageMetadata.description,
    publishedDate: pageMetadata.publishedDate,
    channelTitle: pageMetadata.channelTitle ?? trimText(
      typeof oembedMetadata?.author_name === "string" ? oembedMetadata.author_name : null,
      256
    ),
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}
