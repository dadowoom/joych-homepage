import {
  useId,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode } from "react";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
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
import Youtube from "@tiptap/extension-youtube";
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
  Code2,
  CornerDownLeft,
  Eraser,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
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
  Unlink,
  Youtube as YoutubeIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { Details, DetailsSummary, DivBlock, Figcaption, Figure, SectionBlock } from "./tiptapCustomNodes";

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

type EditorSelectionBookmark = ReturnType<Editor["state"]["selection"]["getBookmark"]>;

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
const HIGHLIGHT_COLORS = [
  { label: "노랑", color: "#fef08a" },
  { label: "초록", color: "#bbf7d0" },
  { label: "파랑", color: "#bfdbfe" },
  { label: "빨강", color: "#fecaca" },
  { label: "보라", color: "#e9d5ff" },
  { label: "주황", color: "#fed7aa" },
];
const TABLE_PRESET_OPTIONS = [
  { label: "기본", value: "default" },
  { label: "헤더", value: "header" },
  { label: "구분", value: "soft" },
  { label: "강조", value: "strong" },
  { label: "테두리 없음", value: "borderless" },
  { label: "테두리 표시", value: "bordered" },
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
  ADD_TAGS: ["iframe", "mark", "figure", "figcaption", "details", "summary", "section"],
  ADD_ATTR: [
    "allow",
    "allowfullscreen",
    "class",
    "frameborder",
    "height",
    "loading",
    "open",
    "referrerpolicy",
    "rel",
    "sandbox",
    "scrolling",
    "src",
    "style",
    "target",
    "title",
    "width",
  ],
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ["script", "object", "embed", "link", "meta", "base", "form", "input", "button", "select", "textarea", "fieldset", "output"],
};

const ALLOWED_IFRAME_DOMAINS = [
  "youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
  "vimeo.com",
  "player.vimeo.com",
  "google.com",
];

function isAllowedIframeSrc(src: string) {
  if (!src) return false;

  try {
    const url = new URL(src, "https://joych.org");
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();

    if (hostname === "youtu.be") return true;
    if (hostname.includes("google.com") && pathname.startsWith("/maps")) return true;

    return ALLOWED_IFRAME_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

let richTextSanitizeHookRegistered = false;

function ensureRichTextSanitizeHook() {
  if (richTextSanitizeHookRegistered) return;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const element = node as Element;
    if (!element || element.tagName !== "IFRAME") return;

    const src = element.getAttribute("src") || "";
    if (!isAllowedIframeSrc(src)) {
      element.remove();
      return;
    }

    element.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups");
  });

  richTextSanitizeHookRegistered = true;
}

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

function parseCssPixelValue(value: string) {
  const trimmed = value.trim().toLowerCase();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) return null;
  return Number(match[1]);
}

function getRichTextViewerBaseCss(scopeSelector: string) {
  return `
${scopeSelector} .rt-table-scroll {
  overflow: hidden;
  margin: 1rem 0;
  max-width: 100%;
  position: relative;
}
${scopeSelector} .rt-table-scroll table {
  margin: 0;
}
${scopeSelector} .rt-table-scroll td[rowspan],
${scopeSelector} .rt-table-scroll th[rowspan],
${scopeSelector} .rt-table-scroll td[colspan],
${scopeSelector} .rt-table-scroll th[colspan] {
  vertical-align: middle !important;
}
@media (max-width: 640px) {
  ${scopeSelector} * {
    max-width: 100%;
  }
  ${scopeSelector} [data-rt-mobile-font-size] {
    font-size: min(var(--rt-mobile-font-size), 24px) !important;
  }
  ${scopeSelector} .rt-table-scroll[data-rt-openable-table="true"] {
    cursor: zoom-in;
    position: relative;
  }
  ${scopeSelector} .rt-table-scroll[data-rt-fit-table="true"] {
    height: var(--rt-table-fit-height);
  }
  ${scopeSelector} .rt-table-scroll[data-rt-fit-table="true"] table {
    max-width: none !important;
    min-width: var(--rt-table-natural-width) !important;
    transform: scale(var(--rt-table-scale));
    transform-origin: top left;
  }
  ${scopeSelector} .rt-table-scroll[data-rt-openable-table="true"]::after {
    content: "탭해서 크게 보기";
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    border-radius: 9999px;
    background: rgba(17, 24, 39, 0.78);
    color: #fff;
    font-size: 0.68rem;
    font-weight: 600;
    line-height: 1;
    padding: 0.35rem 0.5rem;
    pointer-events: none;
  }
}
`;
}

function normalizeRichTextTableLayoutForViewer(html: string) {
  if (!html || typeof DOMParser === "undefined") return html;

  const documentFragment = new DOMParser().parseFromString(html, "text/html");
  const root = documentFragment.body;

  root.querySelectorAll("col").forEach((node) => {
    const col = node as HTMLElement;
    const style = col.style;
    const width = parseCssPixelValue(style.width);
    const minWidth = parseCssPixelValue(style.minWidth);

    if (width !== null && width < 80) {
      style.removeProperty("width");
    }

    if (minWidth !== null && minWidth < 80) {
      style.removeProperty("min-width");
    }

    if (!style.cssText.trim()) {
      col.removeAttribute("style");
    }
  });

  root.querySelectorAll("td, th").forEach((node) => {
    const cell = node as HTMLElement;
    const text = cell.textContent?.replace(/\s+/g, " ").trim() ?? "";
    const rowSpan = Number(cell.getAttribute("rowspan") ?? "1");
    const colSpan = Number(cell.getAttribute("colspan") ?? "1");

    if (/^\d{1,2}:\d{2}$/.test(text)) {
      cell.style.whiteSpace = "nowrap";
    }

    if (rowSpan > 1 || colSpan > 1) {
      cell.style.verticalAlign = "middle";
    }
  });

  root.querySelectorAll("table").forEach((node) => {
    const table = node as HTMLTableElement;
    if (table.parentElement?.classList.contains("rt-table-scroll")) return;

    const wrapper = documentFragment.createElement("div");
    wrapper.className = "rt-table-scroll";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  root.querySelectorAll("img").forEach((node) => {
    const image = node as HTMLImageElement;
    image.style.removeProperty("width");
    image.style.removeProperty("height");
    image.style.maxWidth = "100%";
    image.style.height = "auto";
  });

  root.querySelectorAll("iframe").forEach((node) => {
    const iframe = node as HTMLIFrameElement;
    iframe.style.removeProperty("width");
    iframe.style.removeProperty("height");
    iframe.style.maxWidth = "100%";
  });

  root.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const tagName = element.tagName.toUpperCase();
    const width = parseCssPixelValue(element.style.width);
    const fontSize = parseCssPixelValue(element.style.fontSize);

    if (!["TABLE", "COL", "TD", "TH", "IMG", "IFRAME"].includes(tagName) && width !== null && width > 320) {
      element.style.removeProperty("width");
      element.style.maxWidth = "100%";
    }

    if (fontSize !== null && fontSize > 24) {
      element.style.setProperty("--rt-mobile-font-size", `${fontSize}px`);
      element.setAttribute("data-rt-mobile-font-size", "true");
    }

    if (!element.style.cssText.trim()) {
      element.removeAttribute("style");
    }
  });

  return root.innerHTML;
}

function sanitizeRichTextForViewer(value: string | null | undefined, scopeSelector: string) {
  const { html, css } = extractStyleBlocks(value);
  ensureRichTextSanitizeHook();
  const cleanHtml = DOMPurify.sanitize(html, richTextSanitizeOptions);
  const normalizedHtml = normalizeRichTextTableLayoutForViewer(cleanHtml);
  const scopedCustomCss = scopeRichTextCss(css, scopeSelector);
  return {
    html: normalizedHtml,
    css: normalizedHtml || scopedCustomCss
      ? (normalizedHtml ? getRichTextViewerBaseCss(scopeSelector) : "") + scopedCustomCss
      : "",
  };
}

function getDirectTableElement(wrapper: HTMLElement) {
  return Array.from(wrapper.children).find((child): child is HTMLTableElement =>
    child instanceof HTMLTableElement
  ) ?? null;
}

function rememberViewerTableOriginalStyle(table: HTMLTableElement) {
  if (table.hasAttribute("data-rt-original-style")) return;
  table.setAttribute("data-rt-original-style", table.getAttribute("style") ?? "");
}

function restoreViewerTableOriginalStyle(table: HTMLTableElement) {
  const originalStyle = table.getAttribute("data-rt-original-style");
  if (originalStyle === null) return false;
  if (originalStyle) {
    table.setAttribute("style", originalStyle);
  } else {
    table.removeAttribute("style");
  }
  table.removeAttribute("data-rt-original-style");
  return true;
}

function resetViewerTableFit(wrapper: HTMLElement, table: HTMLTableElement) {
  wrapper.removeAttribute("data-rt-openable-table");
  wrapper.removeAttribute("data-rt-fit-table");
  wrapper.removeAttribute("role");
  wrapper.removeAttribute("tabindex");
  wrapper.removeAttribute("title");
  wrapper.style.removeProperty("--rt-table-scale");
  wrapper.style.removeProperty("--rt-table-fit-height");
  wrapper.style.removeProperty("--rt-table-natural-width");
  wrapper.style.removeProperty("height");
  if (!restoreViewerTableOriginalStyle(table)) {
    table.style.removeProperty("transform");
    table.style.removeProperty("transform-origin");
    table.style.removeProperty("max-width");
    table.style.removeProperty("min-width");
    table.style.removeProperty("width");
  }
}

function applyViewerTableFit(root: HTMLElement) {
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  const wrappers = root.querySelectorAll<HTMLElement>(".rt-table-scroll");

  wrappers.forEach((wrapper) => {
    const table = getDirectTableElement(wrapper);
    if (!table) return;

    resetViewerTableFit(wrapper, table);
    if (!isMobile) return;

    const wrapperWidth = wrapper.clientWidth;
    if (wrapperWidth <= 0) return;

    rememberViewerTableOriginalStyle(table);
    table.style.maxWidth = "none";
    table.style.width = "max-content";
    const naturalWidth = Math.max(table.scrollWidth, table.offsetWidth);
    const naturalHeight = table.offsetHeight;
    if (naturalWidth <= 0 || naturalHeight <= 0) return;

    const scale = Math.min(1, wrapperWidth / naturalWidth);
    wrapper.setAttribute("data-rt-openable-table", "true");
    wrapper.setAttribute("role", "button");
    wrapper.setAttribute("tabindex", "0");
    wrapper.setAttribute("title", "표 크게 보기");
    if (scale >= 0.98) return;

    wrapper.setAttribute("data-rt-fit-table", "true");
    wrapper.style.setProperty("--rt-table-scale", scale.toFixed(4));
    wrapper.style.setProperty("--rt-table-fit-height", `${Math.ceil(naturalHeight * scale)}px`);
    wrapper.style.setProperty("--rt-table-natural-width", `${Math.ceil(naturalWidth)}px`);
  });
}

export function sanitizeRichTextHtml(value?: string | null) {
  const { html } = extractStyleBlocks(value);
  ensureRichTextSanitizeHook();
  const cleanHtml = DOMPurify.sanitize(html, richTextSanitizeOptions);
  return normalizeRichTextTableLayoutForViewer(cleanHtml);
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

function normalizeTableBorderStyle(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "none" ? "none" : null;
}

function getTableCellStyle(attributes: Record<string, unknown>) {
  const styles: string[] = [];
  const backgroundColor = normalizeOptionalCssColor(attributes.backgroundColor as string | null | undefined);
  const verticalAlign = normalizeTableVerticalAlign(attributes.verticalAlign as string | null | undefined);
  const borderStyle = normalizeTableBorderStyle(attributes.borderStyle as string | null | undefined);

  if (backgroundColor) styles.push(`background-color: ${backgroundColor}`);
  if (verticalAlign) styles.push(`vertical-align: ${verticalAlign}`);
  if (borderStyle === "none") styles.push("border: none");

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
      borderStyle: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeTableBorderStyle(element.style.borderStyle || element.style.border),
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
      borderStyle: {
        default: null,
        parseHTML: (element: HTMLElement) => normalizeTableBorderStyle(element.style.borderStyle || element.style.border),
        renderHTML: getTableCellStyle,
      },
    };
  },
});

function createMergedTableCellAutoAlignTransaction(editor: Editor) {
  const transaction = editor.state.tr;
  let changed = false;

  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") return true;

    const rowSpan = Number(node.attrs.rowspan ?? 1);
    const colSpan = Number(node.attrs.colspan ?? 1);
    const currentAlign = String(node.attrs.align ?? "").trim().toLowerCase();
    const currentVerticalAlign = normalizeTableVerticalAlign(node.attrs.verticalAlign as string | null | undefined);
    const isMergedCell = rowSpan > 1 || colSpan > 1;

    if (!isMergedCell) return true;
    if (currentAlign === "center" && currentVerticalAlign === "middle") return true;

    transaction.setNodeMarkup(position, undefined, {
      ...node.attrs,
      align: "center",
      verticalAlign: "middle",
    });
    changed = true;
    return true;
  });

  return changed ? transaction : null;
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

function getTableCellNodeRangeAtPosition(editor: Editor, position: number) {
  const safePosition = Math.max(
    0,
    Math.min(Math.floor(position), editor.state.doc.content.size),
  );
  const $position = editor.state.doc.resolve(safePosition);

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      return {
        node,
        from: $position.before(depth),
        to: $position.after(depth),
      };
    }
  }

  return null;
}

function getTableCellFocusPositionAtPosition(editor: Editor, position: number) {
  const range = getTableCellNodeRangeAtPosition(editor, position);
  if (!range) return null;

  return Math.min(range.from + 2, range.to - 1);
}

function getValidRememberedTableCellFocusPosition(
  editor: Editor,
  position: number | null,
) {
  if (typeof position !== "number" || !Number.isFinite(position)) return null;
  return getTableCellFocusPositionAtPosition(editor, position);
}

function getCurrentTableNodeRange(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type.name === "table") {
      return {
        from: $from.before(depth),
        to: $from.after(depth),
      };
    }
  }
  return null;
}

function getTableNodeRanges(editor: Editor) {
  const ranges: Array<{ from: number; to: number }> = [];
  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "table") return true;
    ranges.push({ from: position, to: position + node.nodeSize });
    return false;
  });
  return ranges;
}

function getNearestTableNodeRange(editor: Editor) {
  const currentRange = getCurrentTableNodeRange(editor);
  if (currentRange) return currentRange;

  const cursorPosition = editor.state.selection.from;
  return getTableNodeRanges(editor)
    .sort((a, b) => {
      const distanceA = cursorPosition < a.from ? a.from - cursorPosition : cursorPosition > a.to ? cursorPosition - a.to : 0;
      const distanceB = cursorPosition < b.from ? b.from - cursorPosition : cursorPosition > b.to ? cursorPosition - b.to : 0;
      return distanceA - distanceB;
    })[0] ?? null;
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

function getNearestTableCellFocusPosition(editor: Editor, referencePosition = editor.state.selection.from) {
  const cellRanges: Array<{ from: number; to: number }> = [];

  editor.state.doc.descendants((node, position) => {
    if (node.type.name !== "tableCell" && node.type.name !== "tableHeader") return true;
    cellRanges.push({ from: position, to: position + node.nodeSize });
    return false;
  });

  const nearestCell = cellRanges
    .sort((a, b) => Math.abs(a.from - referencePosition) - Math.abs(b.from - referencePosition))[0];

  if (!nearestCell) return null;
  return Math.min(nearestCell.from + 2, nearestCell.to - 1);
}

function focusNearestTableCell(editor: Editor, referencePosition = editor.state.selection.from) {
  const nextCellPosition = getNearestTableCellFocusPosition(editor, referencePosition);
  if (nextCellPosition === null) {
    focusEditorAt(editor, Math.min(referencePosition, editor.state.doc.content.size));
    return;
  }
  focusEditorAt(editor, nextCellPosition);
}

function restoreSelectionBookmark(editor: Editor, bookmark: EditorSelectionBookmark | null) {
  if (!bookmark || editor.isDestroyed) return false;

  try {
    const selection = bookmark.resolve(editor.state.doc);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    return true;
  } catch {
    return false;
  }
}

function hasMeaningfulTextStyleAttributes(attributes: Record<string, unknown>) {
  return Object.values(attributes).some((value) => value !== null && value !== undefined && value !== "");
}

function updateTextStyleColorOnly(
  editor: Editor,
  color: string | null,
  bookmark: EditorSelectionBookmark | null = null,
) {
  restoreSelectionBookmark(editor, bookmark);
  if (editor.isDestroyed) return;

  const textStyleMark = editor.schema.marks.textStyle;
  if (!textStyleMark) return;

  const { selection } = editor.state;
  if (selection.empty) {
    const chain = editor.chain().focus();
    if (color) {
      chain.setColor(color).run();
    } else {
      chain.unsetColor().run();
    }
    return;
  }

  let transaction = editor.state.tr;
  selection.ranges.forEach((range) => {
    const from = range.$from.pos;
    const to = range.$to.pos;

    editor.state.doc.nodesBetween(from, to, (node, position) => {
      if (!node.isText) return;

      const mark = node.marks.find((item) => item.type === textStyleMark);
      const textFrom = Math.max(position, from);
      const textTo = Math.min(position + node.nodeSize, to);
      const nextAttributes = {
        ...(mark?.attrs ?? {}),
        color,
      };

      transaction = transaction.removeMark(textFrom, textTo, textStyleMark);
      if (hasMeaningfulTextStyleAttributes(nextAttributes)) {
        transaction = transaction.addMark(textFrom, textTo, textStyleMark.create(nextAttributes));
      }
    });
  });

  if (transaction.steps.length) {
    editor.view.dispatch(transaction.scrollIntoView());
  }

  focusEditorAt(editor);
}

function getClickedTableCellFocusPosition(
  view: Editor["view"],
  event: MouseEvent,
) {
  if (!(event.target instanceof HTMLElement)) return null;
  if (event.target.closest(".column-resize-handle")) return null;

  const cell = event.target.closest("td, th");
  if (!cell || !view.dom.contains(cell)) return null;

  const coordsPosition = view.posAtCoords({
    left: event.clientX,
    top: event.clientY,
  });
  if (coordsPosition) {
    const position = getTableCellFocusPositionFromDocPosition(
      view.state.doc,
      coordsPosition.pos,
    );
    if (position !== null) return position;
  }

  try {
    return getTableCellFocusPositionFromDocPosition(
      view.state.doc,
      view.posAtDOM(cell, 0),
    );
  } catch {
    return null;
  }
}

function getTableCellFocusPositionFromDocPosition(
  doc: Editor["state"]["doc"],
  position: number,
) {
  const safePosition = Math.max(
    0,
    Math.min(Math.floor(position), doc.content.size),
  );
  const $position = doc.resolve(safePosition);

  for (let depth = $position.depth; depth > 0; depth -= 1) {
    const node = $position.node(depth);
    if (node.type.name === "tableCell" || node.type.name === "tableHeader") {
      const from = $position.before(depth);
      const to = $position.after(depth);
      return Math.min(from + 2, to - 1);
    }
  }

  return null;
}

function focusTableCellIfClickMissed(
  view: Editor["view"],
  focusPosition: number,
) {
  window.requestAnimationFrame(() => {
    const doc = view.state.doc;
    const targetCellPosition = getTableCellFocusPositionFromDocPosition(
      doc,
      focusPosition,
    );
    if (targetCellPosition === null) return;

    const currentCellPosition = getTableCellFocusPositionFromDocPosition(
      doc,
      view.state.selection.from,
    );
    if (currentCellPosition === targetCellPosition) return;

    const SelectionConstructor = view.state.selection.constructor as unknown as {
      near: (resolvedPosition: ReturnType<typeof doc.resolve>) => typeof view.state.selection;
    };
    const selection = SelectionConstructor.near(doc.resolve(targetCellPosition));
    view.focus();
    view.dispatch(view.state.tr.setSelection(selection).scrollIntoView());
  });
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

function RichTextToolbar({
  editor,
  lastTableCellFocusPositionRef,
}: {
  editor: Editor;
  lastTableCellFocusPositionRef: MutableRefObject<number | null>;
}) {
  const [isImageInputOpen, setIsImageInputOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingTextColor, setPendingTextColor] = useState<string | null>(null);
  const [pendingCellBackgroundColor, setPendingCellBackgroundColor] = useState<string | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const textSelectionBookmarkRef = useRef<EditorSelectionBookmark | null>(null);
  const tableSelectionBookmarkRef = useRef<EditorSelectionBookmark | null>(null);
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

  const insertUploadedImages = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) {
      window.alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    if (imageFiles.length !== files.length) {
      window.alert("이미지 파일만 본문에 추가했습니다.");
    }

    setIsUploadingImage(true);
    let failedCount = 0;
    const uploadedUrls: string[] = [];

    try {
      for (const file of imageFiles) {
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

          uploadedUrls.push(result.url);
        } catch {
          failedCount += 1;
        }
      }

      if (uploadedUrls.length > 0) {
        editor.chain().focus().insertContent(
          uploadedUrls.map((url) => ({
            type: "image",
            attrs: { src: url },
          })),
        ).run();
      }

      setImageUrl("");
      setIsImageInputOpen(false);
      if (failedCount > 0) {
        window.alert(`${failedCount}장의 이미지 업로드에 실패했습니다. 파일 용량과 형식을 확인해주세요.`);
      }
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
  const displayedTextColor = pendingTextColor ?? currentTextColor;
  const displayedCellBackgroundColor = pendingCellBackgroundColor ?? currentCellBackgroundColor;
  const currentCellAlign = String(tableCellAttributes.align ?? tableHeaderAttributes.align ?? "");
  const currentCellVerticalAlign = String(
    tableCellAttributes.verticalAlign ?? tableHeaderAttributes.verticalAlign ?? "",
  );
  const hasSelection = !editor.state.selection.empty;
  const currentTableCellRange = getCurrentTableCellNodeRange(editor);
  const rememberedTableCellFocusPosition = currentTableCellRange
    ? null
    : getValidRememberedTableCellFocusPosition(
        editor,
        lastTableCellFocusPositionRef.current,
      );
  const isInTable =
    Boolean(currentTableCellRange) ||
    Boolean(rememberedTableCellFocusPosition) ||
    editor.isActive("table");
  const hasTable = getTableNodeRanges(editor).length > 0;
  const tableToolDisabled = !isInTable;
  const canUndo = editor.can().chain().focus().undo().run();
  const canRedo = editor.can().chain().focus().redo().run();

  useEffect(() => {
    setPendingTextColor(null);
  }, [currentTextColor]);

  useEffect(() => {
    setPendingCellBackgroundColor(null);
  }, [currentCellBackgroundColor]);

  const rememberTextSelection = () => {
    textSelectionBookmarkRef.current = editor.state.selection.getBookmark();
  };

  const rememberTableSelection = () => {
    tableSelectionBookmarkRef.current = editor.state.selection.getBookmark();
  };

  const takeTextSelectionBookmark = () => {
    const bookmark = textSelectionBookmarkRef.current;
    textSelectionBookmarkRef.current = null;
    return bookmark;
  };

  const takeTableSelectionBookmark = () => {
    const bookmark = tableSelectionBookmarkRef.current;
    tableSelectionBookmarkRef.current = null;
    return bookmark;
  };

  const restoreCurrentTextSelection = (bookmark: EditorSelectionBookmark | null = null) => {
    if (restoreSelectionBookmark(editor, bookmark)) {
      return editor.chain().focus();
    }

    const { from, to } = editor.state.selection;
    return editor.chain().focus().setTextSelection({ from, to });
  };

  const tableSelectionCommand = (bookmark: EditorSelectionBookmark | null = null) => {
    restoreSelectionBookmark(editor, bookmark);
    return editor.chain().focus();
  };

  const handleFontFamilyChange = (value: string, bookmark = takeTextSelectionBookmark()) => {
    let chain = restoreCurrentTextSelection(bookmark);
    const nextOption = FONT_FAMILY_OPTIONS.find((option) => option.value === value);
    const currentFontSize = String(editor.getAttributes("textStyle").fontSize ?? "").trim();

    if (!nextOption?.fontFamily) {
      chain = chain.unsetFontFamily();
    } else {
      chain = chain.setFontFamily(nextOption.fontFamily);
    }

    if (currentFontSize) {
      chain = chain.setFontSize(currentFontSize);
    }

    chain.run();
  };

  const handleFontSizeChange = (value: string, bookmark = takeTextSelectionBookmark()) => {
    const chain = restoreCurrentTextSelection(bookmark);
    if (!value) {
      chain.unsetFontSize().run();
      return;
    }

    chain.setFontSize(`${value}px`).run();
  };

  const handleTextColorChange = (value: string, bookmark = takeTextSelectionBookmark()) => {
    const nextColor = normalizeEditorTextColor(value);
    updateTextStyleColorOnly(editor, nextColor, bookmark);
  };

  const clearTextColor = () => {
    updateTextStyleColorOnly(editor, null, takeTextSelectionBookmark());
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
    editor.chain().focus().unsetAllMarks().run();
    clearEditorStoredMarks(editor);
  };

  const clearCurrentCell = (bookmark = takeTableSelectionBookmark()) => {
    restoreSelectionBookmark(editor, bookmark);
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    const ranges = getSelectedTableCellNodeRanges(editor);
    if (!ranges.length) return;
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

  const deleteCurrentRow = (bookmark = takeTableSelectionBookmark()) => {
    restoreSelectionBookmark(editor, bookmark);
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    if (!confirmActionAndKeepFocus("현재 행 전체를 삭제할까요?", focusPosition)) return;
    if (tableSelectionCommand().deleteRow().run()) {
      focusNearestTableCell(editor, focusPosition);
    }
  };

  const deleteCurrentColumn = (bookmark = takeTableSelectionBookmark()) => {
    restoreSelectionBookmark(editor, bookmark);
    const focusPosition = getCurrentTableCellFocusPosition(editor);
    if (!confirmActionAndKeepFocus("현재 열 전체를 삭제할까요?", focusPosition)) return;
    if (tableSelectionCommand().deleteColumn().run()) {
      focusNearestTableCell(editor, focusPosition);
    }
  };

  const deleteCurrentTable = (bookmark = takeTableSelectionBookmark()) => {
    restoreSelectionBookmark(editor, bookmark);
    const tableRange = getNearestTableNodeRange(editor);
    if (!tableRange) {
      window.alert("삭제할 표가 없습니다.");
      focusEditorAt(editor);
      return;
    }

    const focusPosition = Math.min(tableRange.from + 1, tableRange.to - 1);
    if (!confirmActionAndKeepFocus("표 전체를 삭제할까요?", focusPosition)) return;

    const transaction = editor.state.tr.delete(tableRange.from, tableRange.to).scrollIntoView();
    editor.view.dispatch(transaction);
    focusEditorAt(editor, Math.min(tableRange.from, editor.state.doc.content.size));
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

  const handleCellBackgroundColorChange = (value: string, bookmark = takeTableSelectionBookmark()) => {
    tableSelectionCommand(bookmark).setCellAttribute("backgroundColor", value).run();
  };

  const clearCellBackgroundColor = () => {
    tableSelectionCommand(takeTableSelectionBookmark()).setCellAttribute("backgroundColor", null).run();
  };

  const handleCellAlignChange = (value: string) => {
    tableSelectionCommand(takeTableSelectionBookmark()).setCellAttribute("align", value || null).run();
  };

  const handleCellVerticalAlignChange = (value: string) => {
    tableSelectionCommand(takeTableSelectionBookmark()).setCellAttribute("verticalAlign", value || null).run();
  };

  const handleCellBorderStyleChange = (value: "none" | null) => {
    tableSelectionCommand(takeTableSelectionBookmark()).setCellAttribute("borderStyle", value).run();
  };

  const applyTablePreset = (preset: string) => {
    const bookmark = takeTableSelectionBookmark();
    const chain = tableSelectionCommand(bookmark);
    if (preset === "header") {
      chain.setCellAttribute("backgroundColor", "#e8f5e9").setCellAttribute("align", "center").setCellAttribute("verticalAlign", "middle").run();
      return;
    }
    if (preset === "soft") {
      chain.setCellAttribute("backgroundColor", "#f8fafc").setCellAttribute("verticalAlign", "middle").run();
      return;
    }
    if (preset === "strong") {
      chain.setCellAttribute("backgroundColor", "#1b5e20").setCellAttribute("align", "center").setCellAttribute("verticalAlign", "middle").run();
      updateTextStyleColorOnly(editor, "#ffffff", bookmark);
      return;
    }
    if (preset === "borderless") {
      chain.setCellAttribute("borderStyle", "none").run();
      return;
    }
    if (preset === "bordered") {
      chain.setCellAttribute("borderStyle", null).run();
      return;
    }
    chain.setCellAttribute("backgroundColor", null).setCellAttribute("align", null).setCellAttribute("verticalAlign", null).run();
    updateTextStyleColorOnly(editor, null, bookmark);
  };

  const setNodeTypePreservingAlign = (action: () => void) => {
    const { $from } = editor.state.selection;
    const currentAlign = $from.parent.attrs.textAlign as string | undefined;
    action();
    if (currentAlign && currentAlign !== "left") {
      editor.chain().focus().setTextAlign(currentAlign).run();
    }
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
        <ToolbarButton editor={editor} label="본문" isActive={editor.isActive("paragraph")} onClick={() => setNodeTypePreservingAlign(() => editor.chain().focus().setParagraph().run())}>
          <Pilcrow className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="제목 1" isActive={editor.isActive("heading", { level: 1 })} onClick={() => setNodeTypePreservingAlign(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}>
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="제목 2" isActive={editor.isActive("heading", { level: 2 })} onClick={() => setNodeTypePreservingAlign(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="제목 3" isActive={editor.isActive("heading", { level: 3 })} onClick={() => setNodeTypePreservingAlign(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton editor={editor} label="제목 4" isActive={editor.isActive("heading", { level: 4 })} onClick={() => setNodeTypePreservingAlign(() => editor.chain().focus().toggleHeading({ level: 4 }).run())}>
          <Heading4 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-8 w-px bg-gray-200" />
        <select
          aria-label="글꼴 선택"
          className={formattingSelectClassName}
          value={currentFontFamily.value}
          onMouseDown={rememberTextSelection}
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
          onMouseDown={rememberTextSelection}
          onChange={(event) => handleFontSizeChange(event.target.value)}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <option key={option.value || "default"} value={option.value}>
              {option.value ? `${option.label}px` : option.label}
            </option>
          ))}
        </select>
        <div className="flex h-8 items-stretch border border-gray-200 bg-white text-xs text-gray-700 transition hover:border-[#1B5E20]">
          <button
            type="button"
            aria-label="글자색 적용"
            onMouseDown={(event) => {
              event.preventDefault();
              rememberTextSelection();
              handleTextColorChange(displayedTextColor);
            }}
            className="flex items-center gap-1 px-2 hover:bg-gray-50"
          >
            <span className="text-[11px] font-semibold">색상</span>
            <span className="inline-block h-3 w-3 rounded-sm border border-gray-300" style={{ backgroundColor: displayedTextColor }} />
          </button>
          <label className="flex cursor-pointer items-center justify-center border-l border-gray-200 px-1.5 hover:bg-gray-50">
            <input
              aria-label="글자색 선택"
              type="color"
              value={displayedTextColor}
              onMouseDown={rememberTextSelection}
              onInput={(event) => {
                const value = event.currentTarget.value;
                setPendingTextColor(value);
              }}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setPendingTextColor(value);
                handleTextColorChange(value);
              }}
              className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
            />
          </label>
        </div>
        <ToolbarButton editor={editor} label="글자색 제거" onClick={() => {
          rememberTextSelection();
          clearTextColor();
        }}>
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
        <ToolbarButton editor={editor} label="형광펜 제거" onClick={() => editor.chain().focus().unsetHighlight().run()}>
          <Highlighter className="h-4 w-4" />
        </ToolbarButton>
        <select
          aria-label="형광펜 색상"
          className={formattingSelectClassName}
          value=""
          onMouseDown={rememberTextSelection}
          onChange={(event) => {
            const color = event.target.value;
            if (!color) return;
            restoreCurrentTextSelection(takeTextSelectionBookmark()).toggleHighlight({ color }).run();
            event.target.selectedIndex = 0;
          }}
        >
          <option value="">형광펜</option>
          {HIGHLIGHT_COLORS.map((item) => (
            <option key={item.color} value={item.color} style={{ backgroundColor: item.color }}>
              {item.label}
            </option>
          ))}
        </select>
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
        <ToolbarButton editor={editor} label="유튜브 영상 삽입" onClick={() => {
          const url = window.prompt("유튜브 URL을 입력해주세요.", "https://www.youtube.com/watch?v=");
          if (!url?.trim()) return;
          editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
        }}>
          <YoutubeIcon className="h-4 w-4" />
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
            <div className={cn("flex h-8 items-stretch border border-gray-200 bg-white text-xs text-gray-700 transition hover:border-[#1B5E20]", tableToolDisabled && "opacity-40")}>
              <button
                type="button"
                aria-label="셀 배경색 적용"
                disabled={tableToolDisabled}
                onMouseDown={(event) => {
                  event.preventDefault();
                  if (tableToolDisabled) return;
                  rememberTableSelection();
                  handleCellBackgroundColorChange(displayedCellBackgroundColor);
                }}
                className="flex items-center gap-1 px-2 hover:bg-gray-50 disabled:cursor-not-allowed"
              >
                <PaintBucket className="h-3.5 w-3.5" />
              </button>
              <label className={cn("flex items-center justify-center border-l border-gray-200 px-1.5 hover:bg-gray-50", tableToolDisabled ? "cursor-not-allowed" : "cursor-pointer")}>
                <input
                  aria-label="셀 배경색 선택"
                  type="color"
                  value={displayedCellBackgroundColor}
                  disabled={tableToolDisabled}
                  onMouseDown={() => {
                    if (!tableToolDisabled) rememberTableSelection();
                  }}
                  onInput={(event) => {
                    const value = event.currentTarget.value;
                    setPendingCellBackgroundColor(value);
                  }}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setPendingCellBackgroundColor(value);
                    handleCellBackgroundColorChange(value);
                  }}
                  className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                />
              </label>
            </div>
            <ToolbarButton editor={editor} label={isInTable ? "셀 배경색 제거" : "표 셀을 클릭하면 셀 배경색 제거 가능"} disabled={tableToolDisabled} onClick={() => {
              rememberTableSelection();
              clearCellBackgroundColor();
            }}>
              <span className="text-[10px] font-semibold">배X</span>
            </ToolbarButton>
            <select
              aria-label="셀 가로 정렬"
              className={tableToolSelectClassName}
              value={currentCellAlign}
              disabled={tableToolDisabled}
              onMouseDown={() => {
                if (!tableToolDisabled) rememberTableSelection();
              }}
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
              onMouseDown={() => {
                if (!tableToolDisabled) rememberTableSelection();
              }}
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
              onMouseDown={() => {
                if (!tableToolDisabled) rememberTableSelection();
              }}
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
            <ToolbarButton editor={editor} label={isInTable ? "위에 행 추가" : "표 셀을 클릭하면 위에 행 추가 가능"} disabled={tableToolDisabled} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).addRowBefore().run();
            }}>
              행+위
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "아래에 행 추가" : "표 셀을 클릭하면 아래에 행 추가 가능"} disabled={tableToolDisabled} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).addRowAfter().run();
            }}>
              행+아래
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "왼쪽에 열 추가" : "표 셀을 클릭하면 왼쪽에 열 추가 가능"} disabled={tableToolDisabled} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).addColumnBefore().run();
            }}>
              열+왼쪽
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "오른쪽에 열 추가" : "표 셀을 클릭하면 오른쪽에 열 추가 가능"} disabled={tableToolDisabled} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).addColumnAfter().run();
            }}>
              열+오른쪽
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "셀 내용 삭제" : "표 셀을 클릭하면 셀 내용 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={() => {
              rememberTableSelection();
              clearCurrentCell();
            }}>
              셀 비움
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "행 삭제" : "표 셀을 클릭하면 행 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={() => {
              rememberTableSelection();
              deleteCurrentRow();
            }}>
              행 삭제
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "열 삭제" : "표 셀을 클릭하면 열 삭제 가능"} disabled={tableToolDisabled} variant="danger" wide onClick={() => {
              rememberTableSelection();
              deleteCurrentColumn();
            }}>
              열 삭제
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "셀 병합" : "표 셀을 클릭하면 셀 병합 가능"} disabled={tableToolDisabled || !editor.can().mergeCells()} wide onClick={() => {
              rememberTableSelection();
              const bookmark = takeTableSelectionBookmark();
              const merged = tableSelectionCommand(bookmark).mergeCells().run();
              if (merged) {
                tableSelectionCommand().setCellAttribute("align", "center").setCellAttribute("verticalAlign", "middle").run();
              }
            }}>
              병합
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "셀 분할" : "표 셀을 클릭하면 셀 분할 가능"} disabled={tableToolDisabled || !editor.can().splitCell()} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).splitCell().run();
            }}>
              분할
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "헤더 행" : "표 셀을 클릭하면 헤더 행 설정 가능"} disabled={tableToolDisabled} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).toggleHeaderRow().run();
            }}>
              H행
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "헤더 열" : "표 셀을 클릭하면 헤더 열 설정 가능"} disabled={tableToolDisabled} wide onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).toggleHeaderColumn().run();
            }}>
              H열
            </ToolbarButton>
            <ToolbarButton editor={editor} label={isInTable ? "헤더 셀" : "표 셀을 클릭하면 헤더 셀 설정 가능"} disabled={tableToolDisabled} onClick={() => {
              rememberTableSelection();
              tableSelectionCommand(takeTableSelectionBookmark()).toggleHeaderCell().run();
            }}>
              <Baseline className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton editor={editor} label={hasTable ? "표 전체 삭제" : "삭제할 표가 없습니다"} disabled={!hasTable} variant="danger" wide onClick={() => {
              rememberTableSelection();
              deleteCurrentTable();
            }}>
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
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              if (files.length > 0) void insertUploadedImages(files);
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
  const lastTableCellFocusPositionRef = useRef<number | null>(null);
  const [editorMode, setEditorMode] = useState<"visual" | "source">("visual");
  const [sourceHtml, setSourceHtml] = useState("");
  const [, setEditorStateVersion] = useState(0);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Highlight.configure({
        multicolor: true,
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
      }),
      Image.configure({
        allowBase64: false,
        inline: false,
      }),
      Youtube.configure({
        inline: false,
        HTMLAttributes: {
          class: "youtube-embed",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Figure,
      Figcaption,
      Details,
      DetailsSummary,
      DivBlock,
      SectionBlock,
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
          "rich-text-editor-content w-full max-w-full min-w-0 overflow-x-hidden overflow-y-auto break-words bg-white px-3 py-3 text-sm leading-7 outline-none [overflow-wrap:anywhere] [&_*]:max-w-full [&_.selectedCell]:bg-[#EAF6EA] [&_.tableWrapper]:my-4 [&_.tableWrapper]:overflow-x-auto [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-[#D8E8DA] [&_blockquote]:bg-[#F8FBF8] [&_blockquote]:py-2 [&_blockquote]:pl-4 [&_blockquote]:pr-3 [&_blockquote]:text-gray-600 [&_blockquote_p]:my-0 [&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-lg [&_img]:h-auto [&_mark]:rounded [&_mark]:px-1 [&_mark]:py-0.5 [&_table]:w-full [&_table]:border-collapse [&_td]:min-w-[120px] [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-2 [&_td]:break-keep [&_td]:[overflow-wrap:normal] [&_th]:min-w-[120px] [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:break-keep [&_th]:[overflow-wrap:normal]",
          "[&_figure]:my-6 [&_figure]:text-center [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:text-gray-500 [&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:border-gray-200 [&_details]:bg-gray-50 [&_details]:px-4 [&_details]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium",
          minHeightClassName,
        ),
      },
      handleDOMEvents: {
        mousedown: (view, event) => {
          if (event.button !== 0) return false;

          const focusPosition = getClickedTableCellFocusPosition(view, event);
          if (focusPosition === null) return false;

          // 빈 표 셀의 여백을 누르면 브라우저 기본 동작만으로는 커서가
          // 셀 안으로 안 들어가는 경우가 있어, 기본 클릭 처리 후 한 번 보정한다.
          focusTableCellIfClickMissed(view, focusPosition);
          return false;
        },
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

  useEffect(() => {
    if (!editor) return;

    const syncToolbarState = () => {
      const currentCellRange = getCurrentTableCellNodeRange(editor);
      if (currentCellRange) {
        lastTableCellFocusPositionRef.current =
          getCurrentTableCellFocusPosition(editor);
      } else if (
        getValidRememberedTableCellFocusPosition(
          editor,
          lastTableCellFocusPositionRef.current,
        ) === null
      ) {
        lastTableCellFocusPositionRef.current = null;
      }

      setEditorStateVersion((version) => (version + 1) % 100000);
    };

    editor.on("selectionUpdate", syncToolbarState);
    editor.on("transaction", syncToolbarState);
    editor.on("focus", syncToolbarState);
    editor.on("blur", syncToolbarState);
    syncToolbarState();

    return () => {
      editor.off("selectionUpdate", syncToolbarState);
      editor.off("transaction", syncToolbarState);
      editor.off("focus", syncToolbarState);
      editor.off("blur", syncToolbarState);
    };
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    let isApplyingMergedCellAlign = false;

    const syncMergedCellAutoAlign = () => {
      if (isApplyingMergedCellAlign) return;

      const transaction = createMergedTableCellAutoAlignTransaction(editor);
      if (!transaction) return;

      isApplyingMergedCellAlign = true;
      editor.view.dispatch(transaction);
      isApplyingMergedCellAlign = false;
    };

    syncMergedCellAutoAlign();
    editor.on("transaction", syncMergedCellAutoAlign);

    return () => {
      editor.off("transaction", syncMergedCellAutoAlign);
    };
  }, [editor]);

  const switchToSource = () => {
    if (!editor) return;
    setSourceHtml(editor.getHTML());
    setEditorMode("source");
  };

  const switchToVisual = () => {
    if (!editor) return;
    const cleanHtml = sanitizeRichTextHtml(sourceHtml);
    editor.commands.setContent(cleanHtml || "<p></p>", { emitUpdate: false });
    onChange(isEmptyEditorHtml(cleanHtml) ? "" : cleanHtml);
    setEditorMode("visual");
  };

  if (!editor) {
    return (
      <div className={cn("w-full max-w-full min-w-0 overflow-hidden border border-gray-300 bg-white px-3 py-3 text-sm text-gray-400", minHeightClassName, className)}>
        편집기를 불러오는 중입니다.
      </div>
    );
  }

  return (
    <div id={id} className={cn("w-full max-w-full min-w-0 overflow-visible border border-gray-300 bg-white focus-within:border-[#1B5E20]", className)}>
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition",
            editorMode === "visual"
              ? "border-b-2 border-[#1B5E20] text-[#1B5E20]"
              : "text-gray-500 hover:text-gray-700"
          )}
          onClick={() => editorMode === "source" ? switchToVisual() : null}
        >
          <Eye className="h-3.5 w-3.5" />
          편집기
        </button>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition",
            editorMode === "source"
              ? "border-b-2 border-[#1B5E20] text-[#1B5E20]"
              : "text-gray-500 hover:text-gray-700"
          )}
          onClick={() => editorMode === "visual" ? switchToSource() : null}
        >
          <Code2 className="h-3.5 w-3.5" />
          HTML 소스
        </button>
      </div>

      {editorMode === "visual" && (
        <>
          <RichTextToolbar
            editor={editor}
            lastTableCellFocusPositionRef={lastTableCellFocusPositionRef}
          />
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
        </>
      )}

      {editorMode === "source" && (
        <textarea
          className={cn(
            "w-full resize-y bg-gray-900 px-4 py-3 font-mono text-sm leading-6 text-green-300 outline-none placeholder:text-gray-600",
            minHeightClassName || "min-h-[300px]"
          )}
          value={sourceHtml}
          onChange={(event) => {
            setSourceHtml(event.target.value);
            onChange(isEmptyEditorHtml(event.target.value) ? "" : event.target.value);
          }}
          placeholder="<p>HTML을 직접 입력하세요.</p>"
          spellCheck={false}
        />
      )}
    </div>
  );
}

export function RichTextViewer({ html, className }: RichTextViewerProps) {
  const reactId = useId();
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [zoomedTableHtml, setZoomedTableHtml] = useState<string | null>(null);
  const viewerId = useMemo(() => "rt-" + reactId.replace(/[^a-zA-Z0-9_-]/g, ""), [reactId]);
  const scopeSelector = '.rich-text-viewer[data-rich-text-id="' + viewerId + '"]';
  const { html: cleanHtml, css: scopedCss } = useMemo(
    () => sanitizeRichTextForViewer(html, scopeSelector),
    [html, scopeSelector]
  );

  useEffect(() => {
    const root = viewerRef.current;
    if (!root || typeof window === "undefined") return;

    let frame = 0;
    const scheduleFit = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => applyViewerTableFit(root));
    };

    scheduleFit();
    window.addEventListener("resize", scheduleFit);

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(scheduleFit)
      : null;
    resizeObserver?.observe(root);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", scheduleFit);
      resizeObserver?.disconnect();
    };
  }, [cleanHtml]);

  const openFittedTable = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return;
    const wrapper = target.closest<HTMLElement>(".rt-table-scroll[data-rt-openable-table='true']");
    if (!wrapper) return;
    const table = getDirectTableElement(wrapper);
    if (!table) return;

    const clone = table.cloneNode(true) as HTMLTableElement;
    resetViewerTableFit(wrapper, table);
    restoreViewerTableOriginalStyle(clone);
    clone.style.removeProperty("transform");
    clone.style.removeProperty("transform-origin");
    clone.style.maxWidth = "none";
    setZoomedTableHtml(clone.outerHTML);
    window.requestAnimationFrame(() => applyViewerTableFit(wrapper.closest<HTMLElement>(".rich-text-viewer") ?? wrapper));
  };

  if (!cleanHtml && !scopedCss) return null;

  return (
    <>
      {scopedCss ? <style>{scopedCss}</style> : null}
      <div
        ref={viewerRef}
        data-rich-text-id={viewerId}
        className={cn(
          "rich-text-viewer max-w-none overflow-x-hidden text-sm leading-7 text-gray-700",
          "[&_a]:text-[#1B5E20] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-[#D8E8DA] [&_blockquote]:pl-4 [&_blockquote]:text-gray-600",
          "[&_h2]:mb-3 [&_h2]:mt-5 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-[#001B3A] [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-[#001B3A]",
          "[&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-[#001B3A] [&_h4]:mb-2 [&_h4]:mt-3 [&_h4]:text-base [&_h4]:font-bold [&_h4]:text-[#001B3A]",
          "[&_figure]:my-6 [&_figure]:text-center [&_figcaption]:mt-2 [&_figcaption]:text-xs [&_figcaption]:text-gray-500",
          "[&_details]:my-4 [&_details]:rounded-lg [&_details]:border [&_details]:border-gray-200 [&_details]:bg-gray-50 [&_details]:px-4 [&_details]:py-2 [&_summary]:cursor-pointer [&_summary]:font-medium [&_summary]:text-gray-700",
          "[&_mark]:rounded [&_mark]:px-1 [&_mark]:py-0.5",
          "[&_iframe]:my-4 [&_iframe]:aspect-video [&_iframe]:w-full [&_iframe]:rounded-lg",
          "min-w-0 break-words [overflow-wrap:anywhere] [&_*]:max-w-full [&_hr]:my-5 [&_hr]:border-gray-200 [&_img]:mx-auto [&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc",
          "[&_section]:my-4 [&_table]:my-4 [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-xs sm:[&_table]:text-sm [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:break-keep [&_td]:[overflow-wrap:normal] [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:break-keep [&_th]:[overflow-wrap:normal]",
          className,
        )}
        onClick={(event) => openFittedTable(event.target)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          const target = event.target;
          if (!(target instanceof Element) || !target.closest(".rt-table-scroll[data-rt-openable-table='true']")) return;
          event.preventDefault();
          openFittedTable(target);
        }}
        dangerouslySetInnerHTML={{ __html: cleanHtml }}
      />
      {zoomedTableHtml ? (
        <div
          className="fixed inset-0 z-[1000] bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setZoomedTableHtml(null)}
        >
          <div
            className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <strong className="text-sm text-gray-900">표 크게 보기</strong>
              <button
                type="button"
                className="rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                onClick={() => setZoomedTableHtml(null)}
              >
                닫기
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div
                className={cn(
                  "rich-text-viewer max-w-none text-sm leading-7 text-gray-700",
                  "[&_table]:min-w-max [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2",
                )}
                dangerouslySetInnerHTML={{ __html: zoomedTableHtml }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
