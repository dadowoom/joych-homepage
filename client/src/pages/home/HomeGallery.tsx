import { Link } from "wouter";
import { FadeIn } from "./_helpers";

const GALLERY_PAGE_HREF = "/page/커뮤니티-최근-행사-사진";

type HomeGalleryItem = {
  imageUrl: string;
  albumKey?: string | null;
  albumTitle?: string | null;
  caption?: string | null;
  gridSpan?: string | null;
};

type HomeGalleryProps = {
  gallery: HomeGalleryItem[];
};

function getHomeGalleryTitle(item: HomeGalleryItem) {
  return item.albumTitle?.trim() || item.caption?.trim() || "최근 행사 사진";
}

function getHomeGalleryHref(item: HomeGalleryItem) {
  const params = new URLSearchParams();
  const albumKey = item.albumKey?.trim();
  const albumTitle = item.albumTitle?.trim();

  if (albumKey) {
    params.set("gallery", `album:${albumKey}`);
  } else if (albumTitle) {
    params.set("gallery", `album-title:${albumTitle}`);
  }

  const query = params.toString();
  return query ? `${GALLERY_PAGE_HREF}?${query}` : GALLERY_PAGE_HREF;
}

export default function HomeGallery({ gallery }: HomeGalleryProps) {
  return (
    <section className="py-16 bg-white">
      <div className="container">
        <FadeIn>
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs tracking-[0.25em] text-[#1B5E20] font-semibold mb-2 uppercase">
                Photo Gallery
              </p>
              <h2
                className="text-2xl md:text-3xl font-bold text-gray-900"
                style={{ fontFamily: "'Noto Serif KR', serif" }}
              >
                교회 갤러리
              </h2>
            </div>
            <Link
              href="/page/커뮤니티-최근-행사-사진"
              className="text-sm text-gray-400 hover:text-[#1B5E20] flex items-center gap-1 transition-colors"
            >
              전체보기 <i className="fas fa-arrow-right text-[10px]"></i>
            </Link>
          </div>
        </FadeIn>

        <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[180px] md:auto-rows-[220px] gap-3">
          {gallery.map((item, i) => (
            <FadeIn
              key={item.albumKey ?? item.albumTitle ?? item.imageUrl ?? i}
              delay={i * 60}
              className={item.gridSpan ?? "col-span-1 row-span-1"}
            >
              <Link
                href={getHomeGalleryHref(item)}
                className="group relative block w-full h-full overflow-hidden rounded-xl bg-[#E9ECE5] shadow-sm ring-1 ring-black/5"
              >
                <img
                  src={item.imageUrl}
                  alt={getHomeGalleryTitle(item)}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/28 to-transparent transition-all duration-300 group-hover:from-black/86 group-hover:via-black/38" />
                <div className="absolute right-4 top-4">
                  <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[11px] font-medium text-white/90 opacity-0 backdrop-blur-sm transition-opacity duration-300 group-hover:opacity-100">
                    앨범 보기
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
                  <p
                    className="truncate text-base font-semibold leading-snug text-white drop-shadow-sm md:text-lg"
                    style={{ fontFamily: "'Noto Serif KR', serif" }}
                  >
                    {getHomeGalleryTitle(item)}
                  </p>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
