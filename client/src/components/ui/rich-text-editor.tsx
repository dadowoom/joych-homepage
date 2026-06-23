import {
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode } from "react";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { FontFamily,
  FontSize,
  TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent,
  useEditor,
  type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
  Unlink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  minHeightClassName?: string;
  className?: string;
};

type RichTextViewerProps = {
  html?: string | null;
  className?: string;
};

const htmlPattern = /<[a-z][\s\S]*>/i;
const escapedHtmlTagPattern = /&lt;\/?[a-z][\s\S]*?&gt;/i;
const FONT_SIZE_OPTIONS = [
  { label: "기본", value: "" },
  { label: "12", value: "12" },
  { label: "14", value: "14" },
  { label: "16", value: "16" },
  { label: "18", value: "18" },
  { label: "20", value: "20" },
  { label: "24", value: "24" },
  { label: "28", value: "28" },
  { label: "32", value: "32" },
];
const FONT_FAMILY_OPTIONS = [
  { label: "기본 글꼴", value: "default", fontFamily: null },
  { label: "고딕", value: "sans", fontFamily: "'Noto Sans KR', sans-serif" },
  { label: "명조", value: "serif", fontFamily: "'Noto Serif KR', serif" },
];
const formattingSelectClassName =
  "h-8 min-w-[5rem] border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition hover:border-[#1B5E20] focus:border-[#1B5E20]";
const richTextSanitizeOptions = {
  ADD_TAGS: ["iframe"],
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "class",
    "frameborder",
    "height",
    "loading",
    "referrerpolicy",
    "rel",
    "scrolling",
    "style",
    "target",
    "title",
    "width",
  ],
  FORBID_TAGS: ["script", "object", "embed", "link", "meta", "base"],
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

export function normalizeRichTextValue(value?: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  const htmlCandidate = escapedHtmlTagPattern.test(trimmed) ? decodeHtmlEntities(trimmed) : trimmed;
  if (htmlPattern.test(htmlCandidate)) return htmlCandidate;

  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const STYLE_BLOCK_RE = /<\s*style\b[^>]*>([\s\S]*?)<\s*\/\s*style\s*>/gi;
const UNSAFE_CSS_RE =
  /@import\b|javascript\s*:|vbscript\s*:|expression\s*\(|behavior\s*:|-moz-binding\s*:|url\s*\(/i;

function extractStyleBlocks(value?: string | null) {
  const html = value || "";
  const cssBlocks: string[] = [];
  STYLE_BLOCK_RE.lastIndex = 0;
  const htmlWithoutStyles = html.replace(STYLE_BLOCK_RE, (_match: string, css: string) => {
    cssBlocks.push(String(css || ""));
    return "";
  });

  return { html: htmlWithoutStyles, css: cssBlocks.join("\n") };
}

function isUnsafeCss(css: string) {
  return UNSAFE_CSS_RE.test(css);
}

function findClosingCssBrace(css: string, openIndex: number) {
  let depth = 0;
  for (let index = openIndex; index < css.length; index += 1) {
    if (css[index] === "{") depth += 1;
    if (css[index] === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function prefixCssSelector(selector: string, scopeSelector: string) {
  const trimmed = selector.trim();
  if (!trimmed) return "";
  if (trimmed === "&") return scopeSelector;
  if (trimmed.startsWith("&")) return scopeSelector + trimmed.slice(1);
  if (trimmed.startsWith(scopeSelector)) return trimmed;
  if (/^(html|body|:root)\b/i.test(trimmed)) {
    return trimmed.replace(/^(html|body|:root)\b/i, scopeSelector);
  }
  return scopeSelector + " " + trimmed;
}

function scopeCssRules(css: string, scopeSelector: string) {
  let output = "";
  let index = 0;

  while (index < css.length) {
    const openIndex = css.indexOf("{", index);
    if (openIndex < 0) break;

    const selector = css.slice(index, openIndex).trim();
    const closeIndex = findClosingCssBrace(css, openIndex);
    if (closeIndex < 0) break;

    const body = css.slice(openIndex + 1, closeIndex).trim();
    if (/^@(media|supports)\b/i.test(selector)) {
      const nested = scopeCssRules(body, scopeSelector);
      if (nested) output += selector + "{" + nested + "}";
    } else if (!selector.startsWith("@")) {
      const scopedSelector = selector
        .split(",")
        .map((part) => prefixCssSelector(part, scopeSelector))
        .filter(Boolean)
        .join(", ");
      if (scopedSelector && body) output += scopedSelector + "{" + body + "}";
    }

    index = closeIndex + 1;
  }

  return output;
}

function scopeRichTextCss(css: string, scopeSelector: string) {
  const trimmedCss = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  if (!trimmedCss || isUnsafeCss(trimmedCss)) return "";
  return scopeCssRules(trimmedCss, scopeSelector);
}

function sanitizeRichTextForViewer(value: string | null | undefined, scopeSelector: string) {
  const { html, css } = extractStyleBlocks(value);
  return {
    html: DOMPurify.sanitize(html, richTextSanitizeOptions),
    css: scopeRichTextCss(css, scopeSelector),
  };
}

export function sanitizeRichTextHtml(value?: string | null) {
  const { html } = extractStyleBlocks(value);
  return DOMPurify.sanitize(html, richTextSanitizeOptions);
}

function isEmptyEditorHtml(value: string) {
  return value === "<p></p>" || value === "";
}

function getEditorContentForValue(value?: string | null) {
  return normalizeRichTextValue(value) || "<p></p>";
}

function isSameEditorHtmlValue(currentHtml: string, nextValue: string) {
  if (isEmptyEditorHtml(currentHtml) && !nextValue) return true;
  return currentHtml === nextValue;
}

function normalizeFontFamilyName(value: string | null | undefined) {
  return (value ?? "").replace(/["']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getActiveFontFamilyOption(editor: Editor) {
  const activeFontFamily = normalizeFontFamilyName(
    editor.getAttributes("textStyle").fontFamily as string | undefined,
  );
  if (!activeFontFamily) return FONT_FAMILY_OPTIONS[0];

  return (
    FONT_FAMILY_OPTIONS.find((option) => {
      if (!option.fontFamily) return false;
      return normalizeFontFamilyName(option.fontFamily) === activeFontFamily;
    }) ?? FONT_FAMILY_OPTIONS[0]
  );
}

function getActiveFontSizeValue(editor: Editor) {
  const fontSize = String(editor.getAttributes("textStyle").fontSize ?? "").trim();
  return fontSize.endsWith("px") ? fontSize.slice(0, -2) : fontSize;
}

function clearEditorStoredMarks(editor: Editor) {
  if (editor.isDestroyed) return;
  const transaction = editor.state.tr.setStoredMarks([]);
  editor.view.dispatch(transaction);
}

function ToolbarButton({
  editor,
  label,
  isActive,
  onClick,
  children,
}: {
  editor: Editor;
  label: string;
  isActive?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      onMouseDown={(event) => {
        event.preventDefault();
        onClick();
      }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center border border-gray-200 bg-white text-gray-700 transition hover:border-[#1B5E20] hover:bg-[#F1F8E9] hover:text-[#1B5E20]",
        isActive && "border-[#1B5E20] bg-[#EAF6EA] text-[#1B5E20]",
      )}
      disabled={!editor.isEditable}
    >
      {children}
    </button>
  );
}

function RichTextToolbar({ editor }: { editor: Editor }) {
  const [isImageInputOpen, setIsImageInputOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const uploadImageMutation = trpc.cms.blocks.uploadImage.useMutation();

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 주소를 입력해주세요.", previousUrl ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  const insertImage = () => {
    if (!imageUrl.trim()) return;
    editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
    setImageUrl("");
    setIsImageInputOpen(false);
  };

  const insertUploadedImage = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      window.alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setIsUploadingImage(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result ?? "");
          resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
        reader.readAsDataURL(file);
      });

      const result = await uploadImageMutation.mutateAsync({
        base64,
        mimeType: file.type,
        fileName: file.name,
      });

      editor.chain().focus().setImage({ src: result.url }).run();
      setImageUrl("");
      setIsImageInputOpen(false);
    } catch {
      window.alert("이미지 업로드에 실패했습니다. 파일을 확인한 뒤 다시 시도해주세요.");
    } finally {
      setIsUploadingImage(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  };

  const currentFontFamily = getActiveFontFamilyOption(editor);
  const currentFontSize = getActiveFontSizeValue(editor);

  const handleFontFamilyChange = (value: string) => {
    const nextOption = FONT_FAMILY_OPTIONS.find((option) => option.value === value);
    if (!nextOption?.fontFamily) {
      editor.chain().focus().unsetFontFamily().run();
      return;
    }

    editor.chain().focus().setFontFamily(nextOption.fontFamily).run();
  };

  const handleFontSizeChange = (value: string) => {
    if (!value) {
      editor.chain().focus().unsetFontSize().run();
      return;
    }

    editor.chain().focus().setFontSize(`${value}px`).run();
  };

  return (
    <div className="border-b border-gray-200 bg-gray-50">
      <div className="flex flex-wrap items-center gap-1 p-2">
        <ToolbarButton editor={editor} label="본문" isActive={editor.isActive("paragraph")} onClick={() => editor.chain().focus().setParagraph().run()}>
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="제목 2" isActive={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="제목 3" isActive={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <select
          aria-label="글꼴 선택"
          className={formattingSelectClassName}
          value={currentFontFamily.value}
          onChange={(event) => handleFontFamilyChange(event.target.value)}
        >
          {FONT_FAMILY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="글자 크기 선택"
          className={formattingSelectClassName}
          value={currentFontSize}
          onChange={(event) => handleFontSizeChange(event.target.value)}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <option key={option.value || "default"} value={option.value}>
              {option.value ? `${option.label}px` : option.label}
            </option>
          ))}
        </select>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <ToolbarButton editor={editor} label="굵게" isActive={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="기울임" isActive={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="밑줄" isActive={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="취소선" isActive={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <ToolbarButton editor={editor} label="왼쪽 정렬" isActive={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()}>
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="가운데 정렬" isActive={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()}>
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="오른쪽 정렬" isActive={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()}>
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <ToolbarButton editor={editor} label="글머리 목록" isActive={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="번호 목록" isActive={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="인용" isActive={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <ToolbarButton editor={editor} label="링크" isActive={editor.isActive("link")} onClick={setLink}>
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="링크 해제" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Unlink className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="이미지 직접 입력" onClick={() => setIsImageInputOpen((current) => !current)}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <ToolbarButton editor={editor} label="실행 취소" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="다시 실행" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>
      {isImageInputOpen && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-2 py-2">
          <input
            type="url"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                insertImage();
              }
            }}
            placeholder="https://example.com/image.jpg"
            className="h-9 min-w-[16rem] flex-1 border border-gray-200 px-3 text-sm outline-none focus:border-[#1B5E20]"
          />
          <button
            type="button"
            onClick={insertImage}
            className="h-9 rounded border border-[#1B5E20] px-3 text-sm font-medium text-[#1B5E20] transition hover:bg-[#F1F8E9]"
          >
            이미지 삽입
          </button>
          <input
            ref={imageFileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void insertUploadedImage(file);
            }}
          />
          <button
            type="button"
            onClick={() => imageFileInputRef.current?.click()}
            disabled={isUploadingImage}
            className="h-9 rounded border border-gray-200 px-3 text-sm font-medium text-gray-600 transition hover:border-[#1B5E20] hover:bg-[#F1F8E9] hover:text-[#1B5E20] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isUploadingImage ? "업로드 중..." : "파일 업로드"}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsImageInputOpen(false);
              setImageUrl("");
            }}
            className="h-9 rounded border border-gray-200 px-3 text-sm text-gray-500 transition hover:bg-gray-50"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}

export function RichTextEditor({
  value,
  onChange,
  id,
  placeholder = "내용을 입력해주세요.",
  minHeightClassName = "min-h-64",
  className,
}: RichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      TextStyle,
      FontFamily.configure({
        types: ["textStyle"],
      }),
      FontSize,
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      Image.configure({
        allowBase64: false,
        inline: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    [placeholder],
  );

  const editor = useEditor({
    extensions,
    content: getEditorContentForValue(value),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "rich-text-editor-content w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto break-words bg-white px-3 py-3 text-sm leading-7 outline-none [overflow-wrap:anywhere] [&_*]:max-w-full [&_img]:h-auto",
          minHeightClassName,
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      onChange(isEmptyEditorHtml(html) ? "" : html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = normalizeRichTextValue(value);
    if (!isSameEditorHtmlValue(editor.getHTML(), nextValue)) {
      if (editor.isFocused) return;
      editor.commands.setContent(nextValue || "<p></p>", { emitUpdate: false });
      clearEditorStoredMarks(editor);
    }
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn("w-full max-w-full min-w-0 overflow-hidden border border-gray-300 bg-white px-3 py-3 text-sm text-gray-400", minHeightClassName, className)}>
        편집기를 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div id={id} className={cn("w-full max-w-full min-w-0 overflow-hidden border border-gray-300 bg-white focus-within:border-[#1B5E20]", className)}>
      <RichTextToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

export function RichTextViewer({ html, className }: RichTextViewerProps) {
  const reactId = useId();
  const viewerId = useMemo(() => "rt-" + reactId.replace(/[^a-zA-Z0-9_-]/g, ""), [reactId]);
  const scopeSelector = '.rich-text-viewer[data-rich-text-id="' + viewerId + '"]';
  const { html: cleanHtml, css: scopedCss } = useMemo(
    () => sanitizeRichTextForViewer(html, scopeSelector),
    [html, scopeSelector]
  );
  if (!cleanHtml && !scopedCss) return null;

  return (
    <>
      {scopedCss ? <style>{scopedCss}</style> : null}
      <div
        data-rich-text-id={viewerId}
        className={cn(
          "rich-text-viewer max-w-none text-sm leading-7 text-gray-700",
          "[&_a]:text-[#1B5E20] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#D8E8DA] [&_blockquote]:pl-4 [&_blockquote]:text-gray-600",
          "[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#001B3A] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#001B3A]",
          "min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_hr]:my-5 [&_hr]:border-gray-200 [&_img]:mx-auto [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc",
          "[&_section]:my-4 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </>
  );
}
