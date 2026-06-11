/**
 * 갤러리 콘텐츠 컴포넌트
 * pageType="gallery" 메뉴에서 표시됩니다.
 * 최근 행사 사진을 게시판 목록과 상세 이미지 보기 형태로 표시합니다.
 */
import { useMemo, useState } from "react";
import { Download, FileImage, Images, LayoutGrid, List, Search, ZoomIn } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Lightbox } from "./Lightbox";

type GalleryItem = {
  id: number;
  imageUrl: string;
  caption?: string | null;
  createdAt?: string | Date | null;
};

type GalleryGroup = {
  key: string;
  title: string;
  createdAt: string | Date | null | undefined;
  images: GalleryItem[];
};

function getGalleryCaption(item: { caption?: string | null }, index: number) {
  const caption = item.caption?.trim();
  return caption || `최근 행사 사진 ${index + 1}`;
}

function formatGalleryDate(value: unknown) {
  if (!value) return "-";

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}.${month}.${day}`;
}

function toTime(value: unknown) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function isToday(value: unknown) {
  if (!value) return false;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function makeGroupKey(item: GalleryItem, index: number) {
  const caption = item.caption?.trim();
  return caption ? `caption:${caption}` : `photo:${item.id || index}`;
}

function buildGalleryGroups(items: GalleryItem[]) {
  const groups = new Map<string, GalleryGroup>();

  items.forEach((item, index) => {
    const key = makeGroupKey(item, index);
    const title = getGalleryCaption(item, index);
    const existing = groups.get(key);

    if (existing) {
      existing.images.push(item);
      if (toTime(item.createdAt) > toTime(existing.createdAt)) {
        existing.createdAt = item.createdAt;
      }
      return;
    }

    groups.set(key, {
      key,
      title,
      createdAt: item.createdAt,
      images: [item],
    });
  });

  return Array.from(groups.values()).sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
}

export function GalleryContent() {
  const { data: items, isLoading } = trpc.home.gallery.useQuery();
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ groupKey: string; imageIndex: number } | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");

  const galleryItems = (items ?? []) as GalleryItem[];
  const galleryGroups = useMemo(() => buildGalleryGroups(galleryItems), [galleryItems]);
  const filteredGroups = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) return galleryGroups;
    return galleryGroups.filter((group) => group.title.toLowerCase().includes(keyword));
  }, [galleryGroups, searchKeyword]);

  const pageSize = 16;
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const activePage = Math.min(page, totalPages);
  const visibleGroups = filteredGroups.slice((activePage - 1) * pageSize, activePage * pageSize);
  const selectedGroup = filteredGroups.find((group) => group.key === selectedGroupKey) ?? null;
  const newGroupCount = filteredGroups.filter((group) => isToday(group.createdAt)).length;
  const activeLightboxGroup = lightbox ? galleryGroups.find((group) => group.key === lightbox.groupKey) : null;
  const activeLightboxImage = activeLightboxGroup && lightbox ? activeLightboxGroup.images[lightbox.imageIndex] : null;
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  }

  if (galleryItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 border-2 border-dashed border-gray-200">
        <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-5">
        <div className="border-b border-gray-100 pb-4">
          <p className="text-sm text-gray-500">
            총 <span className="font-semibold text-[#1B5E20]">{galleryGroups.length}</span>개의 행사
            <span className="ml-2 text-gray-400">사진 {galleryItems.length}장</span>
            {searchKeyword && <span className="ml-2 text-gray-400">검색 결과 {filteredGroups.length}개</span>}
          </p>
          <p className="mt-1 text-xs text-gray-400">행사 제목을 선택하면 사진을 크게 확인할 수 있습니다.</p>
        </div>

        <div className="flex flex-col gap-3 border-b border-[#86C5D8] pb-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-0.5">
              <span className="flex h-6 w-6 items-center justify-center border border-[#86C5D8] bg-white text-[#1B5E20]">
                <List className="h-3.5 w-3.5" />
              </span>
              <span className="flex h-6 w-6 items-center justify-center border border-gray-200 bg-gray-50 text-gray-300">
                <LayoutGrid className="h-3.5 w-3.5" />
              </span>
            </div>
            <span>새 글 {newGroupCount} / {filteredGroups.length}</span>
          </div>
          <form
            className="flex min-w-0 justify-end gap-1"
            onSubmit={(event) => {
              event.preventDefault();
              setSearchKeyword(searchInput);
              setPage(1);
              setSelectedGroupKey(null);
            }}
          >
            <select
              className="h-8 rounded-none border border-gray-300 bg-white px-2 text-xs text-gray-700 outline-none focus:border-[#1B5E20]"
              aria-label="검색 조건"
              defaultValue="title"
            >
              <option value="title">제목</option>
            </select>
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-8 min-w-0 flex-1 rounded-none border border-gray-300 px-2 text-xs outline-none focus:border-[#1B5E20] md:w-56"
              aria-label="검색어"
            />
            <button
              type="submit"
              className="flex h-8 items-center gap-1 border border-[#86C5D8] px-2 text-xs text-[#1B5E20] hover:bg-[#F1F8E9]"
            >
              <Search className="h-3.5 w-3.5" />
              검색
            </button>
          </form>
        </div>

        {filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border-2 border-dashed border-gray-200">
            <Images className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-gray-400 text-sm">해당 조건의 사진이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-8 gap-y-7 border-y border-[#86C5D8] py-5 sm:grid-cols-3 lg:grid-cols-4">
              {visibleGroups.map((group) => {
                const thumbnail = group.images[0];
                const isActive = selectedGroup?.key === group.key;

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setSelectedGroupKey(group.key)}
                    className="group text-center focus:outline-none"
                    aria-current={isActive ? "true" : undefined}
                  >
                    <span className={`mx-auto block overflow-hidden bg-gray-100 ring-1 transition ${
                      isActive ? "ring-2 ring-[#1B5E20]" : "ring-gray-200 group-hover:ring-[#86C5D8]"
                    }`}>
                      <img
                        src={thumbnail.imageUrl}
                        alt={group.title}
                        loading="lazy"
                        className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </span>
                    <span className={`mt-2 block break-keep text-xs leading-5 ${
                      isActive ? "font-semibold text-[#1B5E20]" : "text-gray-700 group-hover:text-[#1B5E20]"
                    }`}>
                      {group.title}
                    </span>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center gap-1 pt-1">
                {pageNumbers.map((pageNumber) => (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => {
                      setPage(pageNumber);
                      setSelectedGroupKey(null);
                    }}
                    className={`h-7 min-w-7 border px-2 text-xs ${
                      activePage === pageNumber
                        ? "border-[#1B5E20] bg-[#1B5E20] text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-[#86C5D8] hover:text-[#1B5E20]"
                    }`}
                  >
                    {pageNumber}
                  </button>
                ))}
              </div>
            )}

            {selectedGroup && (
              <article className="mt-8 border border-gray-200 bg-white">
                <header className="border-t-2 border-[#86C5D8] bg-[#E9F8FC] px-5 py-3">
                  <h2 className="text-base font-bold text-[#006B8F]">{selectedGroup.title}</h2>
                </header>
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 px-5 py-3 text-xs text-gray-500">
                  <span className="font-semibold text-[#1B5E20]">관리자</span>
                  <span className="h-3 w-px bg-gray-200" />
                  <span>등록일 {formatGalleryDate(selectedGroup.createdAt)}</span>
                  <span className="h-3 w-px bg-gray-200" />
                  <span>첨부 {selectedGroup.images.length}개</span>
                </div>
                <div className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="space-y-5">
                    {selectedGroup.images.map((image, imageIndex) => (
                      <figure key={image.id} className="mx-auto max-w-4xl">
                        <button
                          type="button"
                          onClick={() => setLightbox({ groupKey: selectedGroup.key, imageIndex })}
                          className="group relative block w-full overflow-hidden bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B5E20]"
                          aria-label={`${selectedGroup.title} ${imageIndex + 1}번째 사진 크게 보기`}
                        >
                          <img
                            src={image.imageUrl}
                            alt={`${selectedGroup.title} ${imageIndex + 1}`}
                            loading={imageIndex === 0 ? "eager" : "lazy"}
                            className="mx-auto w-full object-contain"
                          />
                          <span className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-[#1B5E20] opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                            <ZoomIn className="h-4 w-4" />
                          </span>
                        </button>
                        <figcaption className="mt-2 flex items-center justify-between text-xs text-gray-400">
                          <span>{imageIndex + 1} / {selectedGroup.images.length}</span>
                          <span>{image.caption || selectedGroup.title}</span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>

                  <aside className="border border-gray-100 p-4 lg:sticky lg:top-24 lg:self-start">
                    <h3 className="mb-4 text-sm font-bold text-gray-900">첨부 이미지</h3>
                    <div className="space-y-3">
                      {selectedGroup.images.map((image, imageIndex) => (
                        <a
                          key={image.id}
                          href={image.imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-start gap-2 border border-dashed border-gray-200 p-3 text-xs text-gray-600 hover:border-[#86C5D8] hover:text-[#1B5E20]"
                        >
                          <FileImage className="mt-0.5 h-4 w-4 shrink-0 text-[#1B5E20]" />
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold">{imageIndex + 1}페이지</span>
                            <span className="block truncate">{selectedGroup.title}</span>
                          </span>
                          <Download className="h-4 w-4 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </aside>
                </div>
              </article>
            )}
          </>
        )}
      </div>

      {activeLightboxImage && activeLightboxGroup && lightbox && (
        <Lightbox
          imageUrl={activeLightboxImage.imageUrl}
          alt={activeLightboxGroup.title}
          caption={activeLightboxGroup.title}
          currentLabel={`${lightbox.imageIndex + 1} / ${activeLightboxGroup.images.length}`}
          onClose={() => setLightbox(null)}
          onPrevious={
            activeLightboxGroup.images.length > 1
              ? () =>
                  setLightbox((current) =>
                    current
                      ? {
                          groupKey: current.groupKey,
                          imageIndex: (current.imageIndex - 1 + activeLightboxGroup.images.length) % activeLightboxGroup.images.length,
                        }
                      : current
                  )
              : undefined
          }
          onNext={
            activeLightboxGroup.images.length > 1
              ? () =>
                  setLightbox((current) =>
                    current
                      ? {
                          groupKey: current.groupKey,
                          imageIndex: (current.imageIndex + 1) % activeLightboxGroup.images.length,
                        }
                      : current
                  )
              : undefined
          }
        />
      )}
    </>
  );
}
