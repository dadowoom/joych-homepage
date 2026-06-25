import {
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode } from "react";
import Color from "@tiptap/extension-color";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
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
  Baseline,
  Bold,
  CornerDownLeft,
  Eraser,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  PaintBucket,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Table as TableIcon,
  Trash2,
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
const TABLE_PRESET_OPTIONS = [
  { label: "기본", value: "default" },
  { label: "헤더", value: "header" },
  { label: "구분", value: "soft" },
  { label: "강조", value: "strong" },
];
const TABLE_SIZE_OPTIONS = [
  { label: "2x2", rows: 2, cols: 2 },
  { label: "3x3", rows: 3, cols: 3 },
  { label: "4x4", rows: 4, cols: 4 },
  { label: "5x4", rows: 5, cols: 4 },
];
const formattingSelectClassName =
  "h-8 min-w-[5rem] border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition hover:border-[#1B5E20] focus:border-[#1B5E20]";
const tableToolSelectClassName =
  "h-8 border border-gray-200 bg-white px-2 text-xs text-gray-700 outline-none transition hover:border-[#1B5E20] focus:border-[#1B5E20]";
const DEFAULT_TEXT_COLOR = "#111827";
const DEFAULT_CELL_BACKGROUND_COLOR = "#ffffff";
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

function normalizeEditorTextColor(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return DEFAULT_TEXT_COLOR;
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed.toLowerCase();
  const rgbMatch = trimmed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!rgbMatch) return DEFAULT_TEXT_COLOR;
  return `#${[rgbMatch[1], rgbMatch[2], rgbMatch[3]]
    .map((component) => Number(component).toString(16).padStart(2, "0"))
    .join("")}`;
}

function normalizeOptionalCssColor(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  return normalizeEditorTextColor(trimmed);
}

function normalizeTableVerticalAlign(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["top", "middle", "bottom"].includes(normalized) ? normalized : null;
}

function getTableCellStyle(attributes: Record<string, unknown>) {
  const styles: string[] = [];
  const backgroundColor = normalizeOptionalCssColor(attributes.backgroundColor as string | null | undefined);
  const verticalAlign = normalizeTableVerticalAlign(attributes.verticalAlign as string | null | undefined);

  if (backgroundColor) styles.push(`background-color: ${backgroundColor}`);
  if (verticalAlign) styles.push(`vertical-align: ${verticalAlign}`);

  return styles.length ? { style: styles.join("; ") } : {};
}

const RichTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeOptionalCssColor(element.style.backgroundColor),
        renderHTML: getTableCellStyle,
      },
      verticalAlign: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeTableVerticalAlign(element.style.verticalAlign),
        renderHTML: getTableCellStyle,
      },
    };
  },
});

const RichTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeOptionalCssColor(element.style.backgroundColor),
        renderHTML: getTableCellStyle,
      },
      verticalAlign: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeTableVerticalAlign(element.style.verticalAlign),
        renderHTML: getTableCellStyle,
      },
    };
  },
});

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

function getCurrentTableCellNodeRange(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      return {
        node,
        from: $from.before(depth),
        to: $from.after(depth),
      };
    }
  }
  return null;
}

function getSelectedTableCellNodeRanges(editor: Editor) {
  const ranges: Array<{ from: number; to: number }> = [];
  const { doc, selection } = editor.state;

  doc.nodesBetween(selection.from, selection.to, (node, position) => {
    if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") return;
    ranges.push({ from: position, to: position + node.nodeSize });
    return false;
  });

  if (!ranges.length) {
    const currentRange = getCurrentTableCellNodeRange(editor);
    if (currentRange) ranges.push({ from: currentRange.from, to: currentRange.to });
  }

  return ranges
    .filter((range, index, allRanges) => allRanges.findIndex((item) => item.from === range.from && item.to === range.to) === index)
    .sort((a, b) => b.from - a.from);
}

function getCurrentTableCellFocusPosition(editor: Editor) {
  const range = getCurrentTableCellNodeRange(editor);
  if (!range) return editor.state.selection.from;

  // 표 셀 안에는 보통 문단 노드가 한 겹 더 있어서 셀 시작점 바로 다음보다
  // 실제 글 입력 위치에 가까운 지점으로 포커스를 되돌리는 편이 표 명령 실행에 안정적이다.
  return Math.min(range.from + 2, range.to - 1);
}

function confirmEditorAction(message: string) {
  if (typeof window === "undefined") return true;
  return window.confirm(message);
}

function focusEditorAt(editor: Editor, position?: number) {
  if (editor.isDestroyed) return;
  if (typeof position === "number") {
    editor.commands.focus(position);
    return;
  }
  editor.commands.focus();
}

function createEmptyParagraph(editor: Editor) {
  const paragraph = editor.schema.nodes.paragraph;
  return paragraph?.createAndFill() ?? paragraph?.create() ?? null;
}

function ToolbarButton({
  editor,
  label,
  isActive,
  disabled,
  variant = "default",
  wide = false,
  onClick,
  children,
}: {
  editor: Editor;
  label: string;
  isActive?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger" | "primary";
  wide?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const isDisabled = disabled || !editor.isEditable;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={isActive}
      onMouseDown={(event) => {
        event.preventDefault();
        if (isDisabled) return;
        onClick();
      }}
      className={cn(
        "inline-flex h-8 items-center justify-center whitespace-nowrap border border-gray-200 bg-white text-gray-700 transition hover:border-[#1B5E20] hover:bg-[#F1F8E9] hover:text-[#1B5E20]",
        wide ? "min-w-[3.75rem] px-2 text-xs font-semibold" : "w-8",
        variant === "primary" && "border-[#1B5E20] bg-[#F1F8E9] text-[#1B5E20]",
        variant === "danger" && "border-red-200 text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700",
        isActive && "border-[#1B5E20] bg-[#EAF6EA] text-[#1B5E20]",
        isDisabled && "cursor-not-allowed opacity-40 hover:border-gray-200 hover:bg-white hover:text-gray-700",
      )}
      disabled={isDisabled}
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
  const currentTextColor = normalizeEditorTextColor(
    editor.getAttributes("textStyle").color as string | undefined,
  );
  const tableCellAttributes = editor.getAttributes("tableCell") as Record<string, unknown>;
  const tableHeaderAttributes = editor.getAttributes("tableHeader") as Record<string, unknown>;
  const currentCellBackgroundColor =
    normalizeOptionalCssColor(
      (tableCellAttributes.backgroundColor ?? tableHeaderAttributes.backgroundColor) as string | undefined,
    ) ?? DEFAULT_CELL_BACKGROUND_COLOR;
  const currentCellAlign = String(tableCellAttributes.align ?? tableHeaderAttributes.align ?? "");
  const currentCellVerticalAlign = String(
    tableCellAttributes.verticalAlign ?? tableHeaderAttributes.verticalAlign ?? "",
  );
  const hasSelection = !editor.state.selection.empty;
  const isInTable = Boolean(getCurrentTableCellNodeRange(editor)) || editor.isActive("table");
  const tableToolDisabled = !isInTable;
  const canUndo = editor.can().chain().focus().undo().run();
  const canRedo = editor.can().chain().focus().redo().run();

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

  const handleTextColorChange = (value: string) => {
    if (!value || value === DEFAULT_TEXT_COLOR) {
      editor.chain().focus().unsetColor().run();
      return;
    }

    editor.chain().focus().setColor(value).run();
  };

  const insertTable = (rows: number, cols: number) => {
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  const insertDefaultTable = () => {
    insertTable(3, 3);
  };

  const deleteSelection = () => {
    editor.chain().focus().deleteSelection().run();
  };

  const confirmActionAndKeepFocus = (message: string, focusPosition = editor.state.selection.from) => {
    const confirmed = confirmEditorAction(message);
    if (!confirmed) focusEditorAt(editor, focusPosition);
    return confirmed;
  };

  const deleteCurrentBlock = () => {
    const focusPosition = editor.state.selection.from;

    if (hasSelection) {
      if (confirmActionAndKeepFocus("선택한 내용을 삭제할까요?", focusPosition)) deleteSelection();
      return;
    }

    if (isInTable) {
      window.alert("표 안에서는 셀 내용 삭제, 행 삭제, 열 삭제, 표 삭제 버튼을 사용해주세요.");
      return;
    }

    // 사용자가 말하는 "줄 삭제"를 편집기 내부에서는 현재 문단/블록 삭제로 처리한다.
    if (!confirmActionAndKeepFocus("현재 줄(문단)을 삭제할까요?", focusPosition)) return;
    editor.chain().focus(focusPosition).selectParentNode().deleteSelection().run();
  };

  const clearFormatting = () => {
    editor.chain().focus().unsetAllMarks().clearNodes().run();
    clearEditorStoredMarks(editor);
  };

  const clearCurrentCell = () => {
    const ranges = getSelectedTableCellNodeRanges(editor);
    if (!ranges.length) return;
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    const message =
      ranges.length > 1
        ? `${ranges.length}개 셀 안의 내용만 삭제할까요? 셀 자체는 유지됩니다.`
        : "현재 셀 안의 내용만 삭제할까요? 셀 자체는 유지됩니다.";
    if (!confirmActionAndKeepFocus(message, focusPosition)) return;

    // 표 구조와 셀 서식은 그대로 두고, 셀 내부의 글/이미지/문단만 빈 문단으로 교체한다.
    let transaction = editor.state.tr;
    ranges.forEach((range) => {
      const emptyParagraph = createEmptyParagraph(editor);
      if (!emptyParagraph) return;
      transaction = transaction.replaceWith(range.from + 1, range.to - 1, emptyParagraph);
    });

    if (!transaction.docChanged) return;
    const firstCell = ranges[ranges.length - 1];
    editor.view.dispatch(transaction.scrollIntoView());
    focusEditorAt(editor, firstCell ? firstCell.from + 2 : focusPosition);
  };

  const deleteCurrentRow = () => {
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    if (!confirmActionAndKeepFocus("현재 행 전체를 삭제할까요?", focusPosition)) return;
    editor.chain().focus(focusPosition).deleteRow().run();
  };

  const deleteCurrentColumn = () => {
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    if (!confirmActionAndKeepFocus("현재 열 전체를 삭제할까요?", focusPosition)) return;
    editor.chain().focus(focusPosition).deleteColumn().run();
  };

  const deleteCurrentTable = () => {
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    if (!confirmActionAndKeepFocus("표 전체를 삭제할까요?", focusPosition)) return;
    const didDelete = editor.chain().focus(focusPosition).deleteTable().run();
    if (!didDelete) {
      window.alert("표 안의 셀을 한 번 클릭한 뒤 다시 표 삭제를 눌러주세요.");
      focusEditorAt(editor, focusPosition);
    }
  };

  const insertLineBreak = () => {
    editor.chain().focus().setHardBreak().run();
  };

  const toggleQuote = () => {
    const focusPosition = editor.state.selection.from;
    const didRun = editor.chain().focus(focusPosition).toggleBlockquote().run();
    if (didRun) return;

    window.alert("현재 위치에서는 인용을 적용할 수 없습니다. 일반 문단에서 다시 시도해주세요.");
    focusEditorAt(editor, focusPosition);
  };

  const handleCellBackgroundColorChange = (value: string) => {
    editor.chain().focus().setCellAttribute("backgroundColor", value).run();
  };

  const clearCellBackgroundColor = () => {
    editor.chain().focus().setCellAttribute("backgroundColor", null).run();
  };

  const handleCellAlignChange = (value: string) => {
    editor.chain().focus().setCellAttribute("align", value || null).run();
  };

  const handleCellVerticalAlignChange = (value: string) => {
    editor.chain().focus().setCellAttribute("verticalAlign", value || null).run();
  };

  const applyTablePreset = (preset: string) => {
    const chain = editor.chain().focus();
    if (preset === "header") {
      chain.setCellAttribute("backgroundColor", "#e8f5e9").setCellAttribute("align", "center").setCellAttribute("verticalAlign", "middle").run();
      return;
    }
    if (preset === "soft") {
      chain.setCellAttribute("backgroundColor", "#f8fafc").setCellAttribute("verticalAlign", "middle").run();
      return;
    }
    if (preset === "strong") {
      chain.setCellAttribute("backgroundColor", "#1b5e20").setCellAttribute("align", "center").setCellAttribute("verticalAlign", "middle").setColor("#ffffff").run();
      return;
    }
    chain.setCellAttribute("backgroundColor", null).setCellAttribute("align", null).setCellAttribute("verticalAlign", null).unsetColor().run();
  };

  return (
    <div className="sticky top-0 z-30 border-b border-gray-200 bg-gray-50 shadow-sm">
      <div className="flex flex-wrap items-center gap-1 p-2">
        <ToolbarButton editor={editor} label="실행 취소 (Ctrl+Z)" disabled={!canUndo} variant="primary" onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="다시 실행 (Ctrl+Y)" disabled={!canRedo} variant="primary" onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
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
        <label className="flex h-8 items-center gap-2 border border-gray-200 bg-white px-2 text-xs text-gray-700 transition hover:border-[#1B5E20]">
          <span>색상</span>
          <input
            aria-label="글자색 선택"
            type="color"
            value={currentTextColor}
            onChange={(event) => handleTextColorChange(event.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <ToolbarButton editor={editor} label="글자색 제거" onClick={() => editor.chain().focus().unsetColor().run()}>
          <span className="text-[10px] font-semibold">색X</span>
        </ToolbarButton>
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
        <ToolbarButton editor={editor} label="인용" isActive={editor.isActive("blockquote")} onClick={toggleQuote}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="구분선" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <Minus className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="줄바꿈" onClick={insertLineBreak}>
          <CornerDownLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="선택 삭제" disabled={!hasSelection} variant="danger" onClick={() => {
          if (confirmActionAndKeepFocus("선택한 내용을 삭제할까요?")) deleteSelection();
        }}>
          <Trash2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="현재 줄 삭제" variant="danger" onClick={deleteCurrentBlock}>
          <span className="text-[10px] font-semibold">줄X</span>
        </ToolbarButton>
        <ToolbarButton editor={editor} label="서식 지우기" onClick={clearFormatting}>
          <Eraser className="h-4 w-4" />
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
        <ToolbarButton editor={editor} label="표 만들기" isActive={editor.isActive("table")} variant="primary" onClick={insertDefaultTable}>
          <TableIcon className="h-4 w-4" />
        </ToolbarButton>
        <select
          aria-label="표 크기 선택"
          className={tableToolSelectClassName}
          defaultValue=""
          onChange={(event) => {
            const option = TABLE_SIZE_OPTIONS.find((item) => item.label === event.target.value);
            if (!option) return;
            insertTable(option.rows, option.cols);
            event.target.value = "";
          }}
        >
          <option value="">표 크기</option>
          {TABLE_SIZE_OPTIONS.map((option) => (
            <option key={option.label} value={option.label}>
              {option.label}
            </option>
          ))}
        </select>
        <>
            <label className={cn("flex h-8 items-center gap-2 border border-gray-200 bg-white px-2 text-xs text-gray-700 transition hover:border-[#1B5E20]", tableToolDisabled && "opacity-40")}>
              <PaintBucket className="h-3.5 w-3.5" />
              <input
                aria-label="셀 배경색 선택"
                type="color"
                value={currentCellBackgroundColor}
                disabled={tableToolDisabled}
                onChange={(event) => handleCellBackgroundColorChange(event.target.value)}
                className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <ToolbarButton editor={editor} label={isInTable ? "셀 배경색 제거" : "표 셀을 클릭하면 셀 배경색 제거 가능"} disabled={tableToolDisabled} onClick={clearCellBackgroundColor}>
              <span className="text-[10px] font-semibold">배X</span>
            </ToolbarButton>
            <select
              aria-label="셀 가로 정렬"
              className={tableToolSelectClassName}
              value={currentCellAlign}
              disabled={tableToolDisabled}
              onChange={(event) => handleCellAlignChange(event.target.value)}
            >
              <option value="">가로</option>
              <option value="left">왼쪽</option>
              <option value="center">가운데</option>
              <option value="right">오른쪽</option>
            </select>
            <select
              aria-label="셀 세로 정렬"
              className={tableToolSelectClassName}
              value={currentCellVerticalAlign}
              disabled={tableToolDisabled}
              onChange={(event) => handleCellVerticalAlignChange(event.target.value)}
            >
              <option value="">세로</option>
              <option value="top">위</option>
              <option value="middle">중간</option>
              <option value="bottom">아래</option>
            </select>
            <select
              aria-label="표 셀 프리셋"
              className={tableToolSelectClassName}
              defaultValue=""
              disabled={tableToolDisabled}
              onChange={(event) => {
                if (!event.target.value) return;
                applyTablePreset(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">프리셋</option>
              {TABLE_PRESET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ToolbarButton editor={editor} label={isInTable ? "위에 행 추가" : "표 셀을 클릭하면 위에 행 추가 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().addRowBefore().run()}>
              행+위
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "아래에 행 추가" : "표 셀을 클릭하면 아래에 행 추가 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().addRowAfter().run()}>
              행+아래
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "왼쪽에 열 추가" : "표 셀을 클릭하면 왼쪽에 열 추가 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().addColumnBefore().run()}>
              열+왼쪽
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "오른쪽에 열 추가" : "표 셀을 클릭하면 오른쪽에 열 추가 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().addColumnAfter().run()}>
              열+오른쪽
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "셀 내용 삭제" : "표 셀을 클릭하면 셀 내용 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={clearCurrentCell}>
              셀 비움
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "행 삭제" : "표 셀을 클릭하면 행 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={deleteCurrentRow}>
              행 삭제
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "열 삭제" : "표 셀을 클릭하면 열 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={deleteCurrentColumn}>
              열 삭제
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "셀 병합" : "표 셀을 클릭하면 셀 병합 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().mergeCells().run()}>
              병합
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "셀 분할" : "표 셀을 클릭하면 셀 분할 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().splitCell().run()}>
              분할
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "헤더 행" : "표 셀을 클릭하면 헤더 행 설정 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
              H행
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "헤더 열" : "표 셀을 클릭하면 헤더 열 설정 가능"} disabled={tableToolDisabled} wide onClick={() => editor.chain().focus().toggleHeaderColumn().run()}>
              H열
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "헤더 셀" : "표 셀을 클릭하면 헤더 셀 설정 가능"} disabled={tableToolDisabled} onClick={() => editor.chain().focus().toggleHeaderCell().run()}>
              <Baseline className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "표 삭제" : "표 셀을 클릭하면 표 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={deleteCurrentTable}>
              표 삭제
            </ToolbarButton>
          </>
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
      Color.configure({
        types: ["textStyle"],
      }),
      FontFamily.configure({
        types: ["textStyle"],
      }),
      FontSize,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      RichTableHeader,
      RichTableCell,
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
          "rich-text-editor-content w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto break-words bg-white px-3 py-3 text-sm leading-7 outline-none [overflow-wrap:anywhere] [&_*]:max-w-full [&_.selectedCell]:bg-[#EAF6EA] [&_.tableWrapper]:my-4 [&_.tableWrapper]:overflow-x-auto [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[#D8E8DA] [&_blockquote]:bg-[#F8FBF8] [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-gray-600 [&_blockquote_p]:my-0 [&_img]:h-auto [&_table]:w-full [&_table]:border-collapse [&_td]:min-w-[120px] [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_th]:min-w-[120px] [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2",
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
    <div id={id} className={cn("w-full max-w-full min-w-0 overflow-visible border border-gray-300 bg-white focus-within:border-[#1B5E20]", className)}>
      <RichTextToolbar editor={editor} />
      <div
        className={cn("cursor-text", minHeightClassName)}
        onMouseDown={(event) => {
          if (event.button !== 0 || !editor.isEmpty) return;
          event.preventDefault();
          editor.chain().focus("end").setParagraph().run();
        }}
      >
        <EditorContent editor={editor} />
      </div>
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
          "rich-text-viewer max-w-none overflow-x-auto text-sm leading-7 text-gray-700",
          "[&_a]:text-[#1B5E20] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#D8E8DA] [&_blockquote]:pl-4 [&_blockquote]:text-gray-600",
          "[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#001B3A] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#001B3A]",
          "min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_hr]:my-5 [&_hr]:border-gray-200 [&_img]:mx-auto [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc",
          "[&_section]:my-4 [&_table]:my-4 [&_table]:min-w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2",
          className,
        )}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
    </>
  );
}
