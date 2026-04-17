/**
 * 동적 메뉴 페이지
 * - 메뉴 편집 패널에서 설정한 pageType에 따라 다른 UI를 표시합니다
 * - URL 형태: /page/item/:id (2단 메뉴) 또는 /page/sub/:id (3단 메뉴)
 * - 공통 레이아웃(헤더+GNB+브레드크럼+사이드메뉴+푸터)은 SubPageLayout이 담당
 *
 * pageType 종류:
 *   image   → 전체화면 이미지 표시 (클릭 시 라이트박스 확대)
 *   gallery → 사진 갤러리 그리드
 *   board   → 게시판 목록
 *   youtube → 유튜브 영상 목록
 *   editor  → 텍스트+이미지 블록 에디터 페이지
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import SubPageLayout from "@/components/SubPageLayout";
import YoutubeListPage from "@/pages/YoutubeListPage";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImageIcon, LayoutGrid, FileText, Youtube, Edit3, X, ZoomIn, Plus, Trash2, GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, Pencil } from "lucide-react";

// ─── 라이트박스 컴포넌트 ─────────────────────────────────────
// 이미지 클릭 시 화면 전체를 어둡게 하고 원본 크기로 보여주는 팝업

function Lightbox({ imageUrl, alt, onClose }: { imageUrl: string; alt: string; onClose: () => void }) {
  // ESC 키로 닫기
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // 라이트박스 열릴 때 배경 스크롤 막기
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 닫기 버튼 */}
      <button
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors"
        onClick={onClose}
        aria-label="닫기"
      >
        <X className="w-6 h-6" />
      </button>

      {/* 이미지 — 클릭해도 닫히지 않도록 이벤트 전파 차단 */}
      <img
        src={imageUrl}
        alt={alt}
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {/* 하단 안내 */}
      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-xs">
        ESC 키 또는 배경 클릭으로 닫기
      </p>
    </div>
  );
}

// ─── pageType별 콘텐츠 컴포넌트 ─────────────────────────────────

function ImageContent({ label, imageUrl }: { label: string; imageUrl: string | null }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // 이미지가 없을 때 안내 메시지
  if (!imageUrl) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <ImageIcon className="w-14 h-14 text-gray-200 mb-4" />
        <p className="text-gray-400 text-base font-medium mb-1">아직 이미지가 등록되지 않았습니다.</p>
        <p className="text-gray-300 text-sm">
          편집 모드 → 메뉴 편집 → 해당 메뉴 선택 후 이미지를 업로드해 주세요.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 이미지 영역 — 페이지 너비 꽉 차게, 클릭 시 라이트박스 */}
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-lg cursor-zoom-in group"
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={imageUrl}
          alt={label}
          className="w-full h-auto object-cover block"
        />
        {/* 호버 시 확대 아이콘 오버레이 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 rounded-full p-3 shadow-lg">
            <ZoomIn className="w-6 h-6 text-gray-700" />
          </div>
        </div>
      </div>

      {/* 클릭 안내 텍스트 */}
      <p className="text-center text-xs text-gray-400 mt-2">
        이미지를 클릭하면 크게 볼 수 있습니다.
      </p>

      {/* 라이트박스 팝업 */}
      {lightboxOpen && (
        <Lightbox
          imageUrl={imageUrl}
          alt={label}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}

function GalleryContent() {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const { data: items, isLoading } = trpc.home.gallery.useQuery();

  if (isLoading) return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  if ((items ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <LayoutGrid className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 사진이 없습니다.</p>
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {(items ?? []).map((item) => (
          <div
            key={item.id}
            className="aspect-square rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-zoom-in group relative"
            onClick={() => setLightboxUrl(item.imageUrl)}
          >
            <img
              src={item.imageUrl}
              alt={item.caption ?? ""}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
              <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>
      {lightboxUrl && (
        <Lightbox imageUrl={lightboxUrl} alt="갤러리 사진" onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
}

function BoardContent() {
  const { data: notices, isLoading } = trpc.home.notices.useQuery();
  if (isLoading) return <div className="text-center py-16 text-gray-400">불러오는 중...</div>;
  if ((notices ?? []).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <FileText className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-gray-400 text-sm">등록된 게시글이 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {(notices ?? []).map((notice) => (
        <div key={notice.id} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          {notice.thumbnailUrl && (
            <img
              src={notice.thumbnailUrl}
              alt={notice.title}
              className="w-16 h-16 object-cover rounded-lg shrink-0"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{notice.category}</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 truncate">{notice.title}</p>
            {notice.content && (
              <p className="text-xs text-gray-500 truncate mt-0.5">{notice.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function YoutubeContent({ label }: { label?: string }) {
  // 첫 번째 플레이리스트를 자동으로 사용
  const { data: playlists = [] } = trpc.youtube.getPlaylists.useQuery();
  const firstPlaylistId = playlists[0]?.id;

  if (!firstPlaylistId) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
        <Youtube className="w-12 h-12 text-red-400 mb-3" />
        <p className="text-gray-500 text-sm font-medium">등록된 유튜브 플레이리스트가 없습니다.</p>
        <p className="text-gray-400 text-xs mt-1">관리자 패널에서 유튜브 편집 버튼을 눌러 영상을 추가해 주세요.</p>
      </div>
    );
  }

  return <YoutubeListPage playlistId={firstPlaylistId} title={label} />;
}

// ─── 블록 타입별 렌더러 함수 ─────────────────────────────────────────────────────

type BlockContent = {
  text?: string;
  urls?: string[];
  captions?: string[];
  videoId?: string;
  title?: string;
  label?: string;
  href?: string;
  style?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  thickness?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
};

function parseContent(raw: string): BlockContent {
  try { return JSON.parse(raw); } catch { return {}; }
}

function BlockRenderer({ block }: { block: { id: number; blockType: string; content: string } }) {
  const [imgLightbox, setImgLightbox] = useState<string | null>(null);
  const c = parseContent(block.content);

  // 텍스트 공통 스타일 (fontSize, align 적용)
  const textStyle: React.CSSProperties = {
    fontSize: c.fontSize ? `${c.fontSize}px` : undefined,
    textAlign: (c.align as React.CSSProperties['textAlign']) ?? 'left',
  };

  switch (block.blockType) {
    case 'text-h1':
      return <h1 className="font-bold text-gray-900 leading-tight mt-8 mb-4" style={{ fontFamily: "'Noto Serif KR', serif", fontSize: c.fontSize ? `${c.fontSize}px` : undefined, textAlign: (c.align as React.CSSProperties['textAlign']) ?? 'left' }}>{c.text}</h1>;
    case 'text-h2':
      return <h2 className="font-bold text-gray-800 leading-tight mt-6 mb-3 border-b-2 border-green-600 pb-2" style={textStyle}>{c.text}</h2>;
    case 'text-h3':
      return <h3 className="font-semibold text-gray-700 mt-5 mb-2" style={textStyle}>{c.text}</h3>;
    case 'text-body':
      return (
        <p className="text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap" style={textStyle}>
          {c.text}
        </p>
      );
    case 'image-single':
      return (
        <>
          <div className="my-4">
            {(c.urls ?? []).slice(0, 1).map((url, i) => (
              <div key={i} className="rounded-xl overflow-hidden shadow-md cursor-zoom-in group relative" onClick={() => setImgLightbox(url)}>
                <img src={url} alt={c.captions?.[i] ?? ''} className="w-full h-auto object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
            {c.captions?.[0] && <p className="text-center text-xs text-gray-400 mt-2">{c.captions[0]}</p>}
          </div>
          {imgLightbox && <Lightbox imageUrl={imgLightbox} alt="" onClose={() => setImgLightbox(null)} />}
        </>
      );
    case 'image-double':
    case 'image-triple': {
      const cols = block.blockType === 'image-triple' ? 'grid-cols-3' : 'grid-cols-2';
      return (
        <>
          <div className={`grid ${cols} gap-3 my-4`}>
            {(c.urls ?? []).map((url, i) => (
              <div key={i} className="rounded-lg overflow-hidden shadow-sm cursor-zoom-in group relative" onClick={() => setImgLightbox(url)}>
                <img src={url} alt={c.captions?.[i] ?? ''} className="w-full h-full object-cover aspect-square" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))}
          </div>
          {imgLightbox && <Lightbox imageUrl={imgLightbox} alt="" onClose={() => setImgLightbox(null)} />}
        </>
      );
    }
    case 'youtube':
      return (
        <div className="my-4 rounded-xl overflow-hidden shadow-md aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${c.videoId}`}
            title={c.title ?? '유튜브 영상'}
            className="w-full h-full"
            allowFullScreen
          />
        </div>
      );
    case 'button':
      return (
        <div className="my-4">
          <a
            href={c.href ?? '#'}
            target={c.href?.startsWith('http') ? '_blank' : undefined}
            rel={c.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            className={
              c.style === 'outline'
                ? 'inline-block px-6 py-3 border-2 border-green-700 text-green-700 rounded-lg font-medium hover:bg-green-50 transition-colors'
                : 'inline-block px-6 py-3 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-colors'
            }
          >
            {c.label ?? '링크'}
          </a>
        </div>
      );
    case 'divider': {
      const thickness = c.thickness ?? 1;
      const lineStyle = c.lineStyle ?? 'solid';
      return (
        <div className="my-6">
          <hr style={{
            borderTopWidth: `${thickness}px`,
            borderTopStyle: lineStyle,
            borderColor: '#d1d5db',
          }} />
        </div>
      );
    }
    default:
      return null;
  }
}

// ─── 블록 타입 선택지 ─────────────────────────────────────────────────────

const BLOCK_TYPES = [
  { value: 'text-h1',      label: '제목 1 (H1)',     icon: 'T' },
  { value: 'text-h2',      label: '제목 2 (H2)',     icon: 'T' },
  { value: 'text-h3',      label: '제목 3 (H3)',     icon: 'T' },
  { value: 'text-body',    label: '본문',             icon: '\u00b6' },
  { value: 'image-single', label: '이미지 1장',       icon: '\ud83d\uddbc' },
  { value: 'image-double', label: '이미지 2장',       icon: '\ud83d\uddbc' },
  { value: 'image-triple', label: '이미지 3장',       icon: '\ud83d\uddbc' },
  { value: 'youtube',      label: '유튜브',         icon: '\u25b6' },
  { value: 'button',       label: '버튼/링크',      icon: '\ud83d\udd17' },
  { value: 'divider',      label: '구분선',         icon: '—' },
] as const;

// 블록 편집 다이얼로그
function BlockEditDialog({
  block,
  onSave,
  onClose,
  isNew,
  menuItemId,
  menuSubItemId,
}: {
  block?: { id?: number; blockType: string; content: string };
  onSave: (blockType: string, content: string) => void;
  onClose: () => void;
  isNew?: boolean;
  menuItemId?: number;
  menuSubItemId?: number;
}) {
  const [blockType, setBlockType] = useState(block?.blockType ?? 'text-body');
  const [text, setText] = useState(() => {
    if (!block?.content) return '';
    try { const c = JSON.parse(block.content); return c.text ?? ''; } catch { return ''; }
  });
  const [urls, setUrls] = useState<string[]>(() => {
    if (!block?.content) return [];
    try { const c = JSON.parse(block.content); return c.urls ?? []; } catch { return []; }
  });
  const [captions, setCaptions] = useState<string[]>(() => {
    if (!block?.content) return [];
    try { const c = JSON.parse(block.content); return c.captions ?? []; } catch { return []; }
  });
  const [videoId, setVideoId] = useState(() => {
    if (!block?.content) return '';
    try { const c = JSON.parse(block.content); return c.videoId ?? ''; } catch { return ''; }
  });
  const [btnLabel, setBtnLabel] = useState(() => {
    if (!block?.content) return '';
    try { const c = JSON.parse(block.content); return c.label ?? ''; } catch { return ''; }
  });
  const [btnHref, setBtnHref] = useState(() => {
    if (!block?.content) return '';
    try { const c = JSON.parse(block.content); return c.href ?? ''; } catch { return ''; }
  });
  const [btnStyle, setBtnStyle] = useState<'solid'|'outline'>(() => {
    if (!block?.content) return 'solid';
    try { const c = JSON.parse(block.content); return c.style ?? 'solid'; } catch { return 'solid'; }
  });
  const [fontSize, setFontSize] = useState<number>(() => {
    if (!block?.content) return 16;
    try { const c = JSON.parse(block.content); return c.fontSize ?? 16; } catch { return 16; }
  });
  const [align, setAlign] = useState<'left'|'center'|'right'>(() => {
    if (!block?.content) return 'left';
    try { const c = JSON.parse(block.content); return c.align ?? 'left'; } catch { return 'left'; }
  });
  const [dividerThickness, setDividerThickness] = useState<number>(() => {
    if (!block?.content) return 1;
    try { const c = JSON.parse(block.content); return c.thickness ?? 1; } catch { return 1; }
  });
  const [dividerLineStyle, setDividerLineStyle] = useState<'solid'|'dashed'|'dotted'>(() => {
    if (!block?.content) return 'solid';
    try { const c = JSON.parse(block.content); return c.lineStyle ?? 'solid'; } catch { return 'solid'; }
  });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = trpc.cms.blocks.uploadImage.useMutation();

  const imgCount = blockType === 'image-single' ? 1 : blockType === 'image-double' ? 2 : 3;

  const handleImageUpload = async (idx: number, file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const result = await uploadMutation.mutateAsync({ base64, mimeType: file.type, fileName: file.name });
        setUrls(prev => { const next = [...prev]; next[idx] = result.url; return next; });
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setUploading(false); }
  };

  const buildContent = () => {
    if (blockType.startsWith('text')) return JSON.stringify({ text, fontSize, align });
    if (blockType.startsWith('image')) return JSON.stringify({ urls, captions });
    if (blockType === 'youtube') return JSON.stringify({ videoId, title: '' });
    if (blockType === 'button') return JSON.stringify({ label: btnLabel, href: btnHref, style: btnStyle });
    if (blockType === 'divider') return JSON.stringify({ thickness: dividerThickness, lineStyle: dividerLineStyle });
    return '{}';
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? '블록 추가' : '블록 수정'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* 블록 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">블록 종류</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              value={blockType}
              onChange={e => setBlockType(e.target.value)}
            >
              {BLOCK_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* 텍스트 블록 */}
          {blockType.startsWith('text') && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[120px] resize-y"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder={blockType === 'text-body' ? '본문 내용을 입력하세요...' : '제목을 입력하세요'}
                />
              </div>
              {/* 글씨 크기 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">글씨 크기 (10~100)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={10} max={100} value={fontSize}
                    onChange={e => setFontSize(Number(e.target.value))}
                    className="flex-1 h-2 accent-green-700"
                  />
                  <input
                    type="number" min={10} max={100} value={fontSize}
                    onChange={e => setFontSize(Math.min(100, Math.max(10, Number(e.target.value))))}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                  />
                  <span className="text-xs text-gray-400">px</span>
                </div>
                {/* 미리보기 */}
                <p className="mt-2 text-gray-500 border border-dashed border-gray-200 rounded p-2 truncate" style={{ fontSize: `${fontSize}px` }}>
                  {text || '미리보기'}
                </p>
              </div>
              {/* 정렬 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">정렬</label>
                <div className="flex gap-2">
                  {(['left','center','right'] as const).map(a => (
                    <button
                      key={a}
                      onClick={() => setAlign(a)}
                      className={`flex-1 py-1.5 rounded text-sm border transition-colors ${
                        align === a ? 'bg-green-700 text-white border-green-700' : 'border-gray-300 text-gray-600 hover:border-green-400'
                      }`}
                    >
                      {a === 'left' ? '◀ 왼쪽' : a === 'center' ? '▶◀ 가운데' : '오른쪽 ▶'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 이미지 블록 */}
          {blockType.startsWith('image') && (
            <div className="space-y-3">
              {Array.from({ length: imgCount }).map((_, i) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-2">이미지 {i + 1}</p>
                  {urls[i] ? (
                    <div className="relative">
                      <img src={urls[i]} alt="" className="w-full h-32 object-cover rounded" />
                      <button
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        onClick={() => setUrls(prev => { const n = [...prev]; n[i] = ''; return n; })}
                      >×</button>
                    </div>
                  ) : (
                    <button
                      className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-green-400 hover:text-green-500 transition-colors"
                      onClick={() => { fileInputRef.current?.click(); (fileInputRef.current as any)._idx = i; }}
                      disabled={uploading}
                    >
                      <Plus className="w-5 h-5 mb-1" />
                      <span className="text-xs">{uploading ? '업로드 중...' : '이미지 선택'}</span>
                    </button>
                  )}
                  <input
                    className="mt-2 w-full border border-gray-200 rounded px-2 py-1 text-xs"
                    placeholder="설명 (선택)"
                    value={captions[i] ?? ''}
                    onChange={e => setCaptions(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                  />
                </div>
              ))}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  const idx = (e.target as any)._idx ?? 0;
                  if (file) handleImageUpload(idx, file);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* 유튜브 블록 */}
          {blockType === 'youtube' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">유튜브 링크 또는 영상 ID</label>
              <input
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="https://youtu.be/xxxx 또는 xxxx"
                value={videoId}
                onChange={e => {
                  const val = e.target.value;
                  // youtu.be/ID 또는 ?v=ID 형식 자동 파싱
                  const match = val.match(/(?:youtu\.be\/|v=)([\w-]{11})/);
                  setVideoId(match ? match[1] : val);
                }}
              />
            </div>
          )}

          {/* 버튼 블록 */}
          {blockType === 'button' && (
            <div className="space-y-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">버튼 텍스트</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={btnLabel} onChange={e => setBtnLabel(e.target.value)} placeholder="버튼에 표시될 텍스트" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">링크 URL</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={btnHref} onChange={e => setBtnHref(e.target.value)} placeholder="https://... 또는 /page/item/1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">스타일</label>
                <div className="flex gap-2">
                  <button onClick={() => setBtnStyle('solid')} className={`px-3 py-1 rounded text-sm ${btnStyle === 'solid' ? 'bg-green-700 text-white' : 'border border-gray-300 text-gray-600'}`}>스타일 1 (실선)</button>
                  <button onClick={() => setBtnStyle('outline')} className={`px-3 py-1 rounded text-sm ${btnStyle === 'outline' ? 'bg-green-700 text-white' : 'border border-gray-300 text-gray-600'}`}>스타일 2 (선만)</button>
                </div>
              </div>
            </div>
          )}

          {/* 구분선 블록 */}
          {blockType === 'divider' && (
            <div className="space-y-4">
              {/* 두께 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  두께: <span className="text-green-700 font-bold">{dividerThickness}px</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={dividerThickness}
                  onChange={e => setDividerThickness(Number(e.target.value))}
                  className="w-full accent-green-700"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>얇게 (1px)</span>
                  <span>두껍게 (10px)</span>
                </div>
              </div>
              {/* 선 스타일 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">선 스타일</label>
                <div className="flex gap-2">
                  {(['solid', 'dashed', 'dotted'] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDividerLineStyle(s)}
                      className={`flex-1 py-2 px-3 rounded border text-sm transition-colors ${
                        dividerLineStyle === s
                          ? 'bg-green-700 text-white border-green-700'
                          : 'border-gray-300 text-gray-600 hover:border-green-400'
                      }`}
                    >
                      {s === 'solid' ? '실선 ——' : s === 'dashed' ? '파선 - - -' : '점선 ···'}
                    </button>
                  ))}
                </div>
              </div>
              {/* 미리보기 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">미리보기</label>
                <div className="bg-gray-50 rounded-lg p-4">
                  <hr style={{
                    borderTopWidth: `${dividerThickness}px`,
                    borderTopStyle: dividerLineStyle,
                    borderColor: '#9ca3af',
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* 저장 버튼 */}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>취소</Button>
            <Button
              className="bg-green-700 hover:bg-green-800 text-white"
              onClick={() => onSave(blockType, buildContent())}
              disabled={uploading}
            >
              {isNew ? '추가' : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 에디터 콘텐츠 (뷰어 + 관리자 편집 UI 통합) ───────────────────────────────

function EditorContent({ menuItemId, menuSubItemId }: { menuItemId?: number; menuSubItemId?: number }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const utils = trpc.useUtils();

  // 공개용: isVisible=true 블록만
  const { data: blocks, isLoading } = trpc.home.pageBlocks.useQuery(
    { menuItemId, menuSubItemId },
    { enabled: !!(menuItemId || menuSubItemId) }
  );
  // 관리자용: 숨김 포함 전체 블록
  const { data: adminBlocks } = trpc.cms.blocks.list.useQuery(
    { menuItemId, menuSubItemId },
    { enabled: isAdmin && !!(menuItemId || menuSubItemId) }
  );

  const displayBlocks = isAdmin ? (adminBlocks ?? []) : (blocks ?? []);

  // 다이얼로그 상태
  const [editingBlock, setEditingBlock] = useState<{ id?: number; blockType: string; content: string } | null>(null);
  const [isNewBlock, setIsNewBlock] = useState(false);

  // 뮣에이션
  const createMut = trpc.cms.blocks.create.useMutation({
    onSuccess: () => { utils.home.pageBlocks.invalidate(); utils.cms.blocks.list.invalidate(); },
  });
  const updateMut = trpc.cms.blocks.update.useMutation({
    onSuccess: () => { utils.home.pageBlocks.invalidate(); utils.cms.blocks.list.invalidate(); },
  });
  const deleteMut = trpc.cms.blocks.delete.useMutation({
    onSuccess: () => { utils.home.pageBlocks.invalidate(); utils.cms.blocks.list.invalidate(); },
  });
  const reorderMut = trpc.cms.blocks.reorder.useMutation({
    onSuccess: () => { utils.home.pageBlocks.invalidate(); utils.cms.blocks.list.invalidate(); },
  });

  const handleSave = async (blockType: string, content: string) => {
    if (isNewBlock) {
      await createMut.mutateAsync({
        menuItemId,
        menuSubItemId,
        blockType,
        content,
        sortOrder: displayBlocks.length,
      });
    } else if (editingBlock?.id) {
      await updateMut.mutateAsync({ id: editingBlock.id, blockType, content });
    }
    setEditingBlock(null);
    setIsNewBlock(false);
  };

  const handleMoveUp = (idx: number) => {
    if (idx === 0) return;
    const ids = displayBlocks.map(b => b.id);
    [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
    reorderMut.mutate({ orderedIds: ids });
  };

  const handleMoveDown = (idx: number) => {
    if (idx === displayBlocks.length - 1) return;
    const ids = displayBlocks.map(b => b.id);
    [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
    reorderMut.mutate({ orderedIds: ids });
  };

  if (isLoading) {
    return <div className="text-center py-16 text-gray-400">내용을 불러오는 중...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* 관리자 편집 툴바 */}
      {isAdmin && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-700">
            <Edit3 className="w-4 h-4" />
            <span className="text-sm font-medium">관리자 편집 모드 — 블록을 추가하거나 수정할 수 있습니다.</span>
          </div>
          <Button
            size="sm"
            className="bg-green-700 hover:bg-green-800 text-white"
            onClick={() => { setIsNewBlock(true); setEditingBlock({ blockType: 'text-body', content: '{}' }); }}
          >
            <Plus className="w-4 h-4 mr-1" /> 블록 추가
          </Button>
        </div>
      )}

      {/* 블록 목록 */}
      {displayBlocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <Edit3 className="w-12 h-12 text-blue-300 mb-3" />
          <p className="text-gray-400 text-base font-medium mb-1">아직 등록된 내용이 없습니다.</p>
          {isAdmin && <p className="text-gray-300 text-sm">위의 '블록 추가' 버튼으로 내용을 입력해 보세요.</p>}
        </div>
      ) : (
        displayBlocks.map((block, idx) => (
          <div key={block.id} className={`group relative ${!block.isVisible ? 'opacity-50' : ''}`}>
            {/* 관리자 액션 버튼 (hover 시 표시) */}
            {isAdmin && (
              <div className="absolute -right-2 top-1 z-10 hidden group-hover:flex flex-col gap-1 bg-white border border-gray-200 rounded-lg shadow-md p-1">
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                  title="수정"
                  onClick={() => { setIsNewBlock(false); setEditingBlock(block); }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600 transition-colors"
                  title="위로"
                  onClick={() => handleMoveUp(idx)}
                  disabled={idx === 0}
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-green-600 transition-colors"
                  title="아래로"
                  onClick={() => handleMoveDown(idx)}
                  disabled={idx === displayBlocks.length - 1}
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-amber-600 transition-colors"
                  title={block.isVisible ? '숨기기' : '보이기'}
                  onClick={() => updateMut.mutate({ id: block.id, isVisible: !block.isVisible })}
                >
                  {block.isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button
                  className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600 transition-colors"
                  title="삭제"
                  onClick={() => { if (confirm('이 블록을 삭제하시겠습니까?')) deleteMut.mutate({ id: block.id }); }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <BlockRenderer block={block} />
          </div>
        ))
      )}

      {/* 블록 편집 다이얼로그 */}
      {editingBlock && (
        <BlockEditDialog
          block={editingBlock}
          isNew={isNewBlock}
          menuItemId={menuItemId}
          menuSubItemId={menuSubItemId}
          onSave={handleSave}
          onClose={() => { setEditingBlock(null); setIsNewBlock(false); }}
        />
      )}
    </div>
  );
}

function renderContent(
  pageType: string,
  label: string,
  imageUrl: string | null,
  menuItemId?: number,
  menuSubItemId?: number,
) {
  switch (pageType) {
    case "image":   return <ImageContent label={label} imageUrl={imageUrl} />;
    case "gallery": return <GalleryContent />;
    case "board":   return <BoardContent />;
    case "youtube": return <YoutubeContent label={label} />;
    case "editor":  return <EditorContent menuItemId={menuItemId} menuSubItemId={menuSubItemId} />;
    default:        return <ImageContent label={label} imageUrl={imageUrl} />;
  }
}

// ─── 2단 메뉴 동적 페이지 ─────────────────────────────────

export function DynamicMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (isLoading) {
    return (
      <SubPageLayout pageTitle="불러오는 중...">
        <div className="flex items-center justify-center py-24 text-gray-400">페이지 불러오는 중...</div>
      </SubPageLayout>
    );
  }

  if (!item) {
    return (
      <SubPageLayout pageTitle="페이지를 찾을 수 없습니다">
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-gray-500 text-lg mb-4">요청하신 페이지가 존재하지 않습니다.</p>
        </div>
      </SubPageLayout>
    );
  }

  const parentMenu = (allMenus ?? []).find(m => (m.items ?? []).some(s => s.href === `/page/item/${itemId}`));
  const sideItems = (parentMenu?.items ?? []).map(s => ({
    id: s.id,
    label: s.label,
    href: s.href ?? null,
    isActive: s.href === `/page/item/${itemId}`,
  }));

  return (
    <SubPageLayout
      pageTitle={item.label}
      parentLabel={parentMenu?.label}
      sideMenuItems={sideItems}
    >
      {renderContent(item.pageType ?? "image", item.label, item.pageImageUrl ?? null, itemId, undefined)}
    </SubPageLayout>
  );
}

// ─── 3단 메뉴 동적 페이지 ─────────────────────────────────

export function DynamicMenuSubItemPage() {
  const { id } = useParams<{ id: string }>();
  const itemId = parseInt(id ?? "0", 10);

  const { data: item, isLoading } = trpc.home.menuSubItem.useQuery(
    { id: itemId },
    { enabled: !!itemId }
  );
  const { data: allMenus } = trpc.home.menus.useQuery();

  if (isLoading) {
    return (
      <SubPageLayout pageTitle="불러오는 중...">
        <div className="flex items-center justify-center py-24 text-gray-400">페이지 불러오는 중...</div>
      </SubPageLayout>
    );
  }

  if (!item) {
    return (
      <SubPageLayout pageTitle="페이지를 찾을 수 없습니다">
        <div className="flex flex-col items-center justify-center py-24">
          <p className="text-gray-500 text-lg mb-4">요청하신 페이지가 존재하지 않습니다.</p>
        </div>
      </SubPageLayout>
    );
  }

  let parentItemLabel: string | undefined;
  let grandParentLabel: string | undefined;
  let sideItems: { id: number; label: string; href: string | null; isActive?: boolean }[] = [];

  for (const topMenu of (allMenus ?? [])) {
    for (const midMenu of (topMenu.items ?? [])) {
      const subItems = (midMenu as { subItems?: { id: number; label: string; href?: string | null }[] }).subItems ?? [];
      if (subItems.some(s => s.href === `/page/sub/${itemId}`)) {
        parentItemLabel = midMenu.label;
        grandParentLabel = topMenu.label;
        sideItems = subItems.map(s => ({
          id: s.id,
          label: s.label,
          href: s.href ?? null,
          isActive: s.href === `/page/sub/${itemId}`,
        }));
        break;
      }
    }
    if (parentItemLabel) break;
  }

  return (
    <SubPageLayout
      pageTitle={item.label}
      parentLabel={parentItemLabel ?? grandParentLabel}
      sideMenuItems={sideItems}
    >
      {renderContent(item.pageType ?? "image", item.label, item.pageImageUrl ?? null, undefined, itemId)}
    </SubPageLayout>
  );
}
