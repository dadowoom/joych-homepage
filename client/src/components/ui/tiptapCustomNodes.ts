import { Node, mergeAttributes } from "@tiptap/core";

type HtmlAttributesArg = {
  HTMLAttributes: Record<string, unknown>;
};

export const Figure = Node.create({
  name: "figure",
  group: "block",
  content: "(block | figcaption)+",
  draggable: true,
  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "figure" }];
  },
  renderHTML({ HTMLAttributes }: HtmlAttributesArg) {
    return ["figure", mergeAttributes(HTMLAttributes), 0];
  },
});

export const Figcaption = Node.create({
  name: "figcaption",
  group: "block",
  content: "inline*",
  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "figcaption" }];
  },
  renderHTML({ HTMLAttributes }: HtmlAttributesArg) {
    return ["figcaption", mergeAttributes(HTMLAttributes), 0];
  },
});

export const Details = Node.create({
  name: "details",
  group: "block",
  content: "detailsSummary block+",
  defining: true,
  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
      open: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "details" }];
  },
  renderHTML({ HTMLAttributes }: HtmlAttributesArg) {
    return ["details", mergeAttributes(HTMLAttributes), 0];
  },
});

export const DetailsSummary = Node.create({
  name: "detailsSummary",
  group: "block",
  content: "inline*",
  defining: true,
  parseHTML() {
    return [{ tag: "summary" }];
  },
  renderHTML({ HTMLAttributes }: HtmlAttributesArg) {
    return ["summary", mergeAttributes(HTMLAttributes), 0];
  },
});

export const DivBlock = Node.create({
  name: "divBlock",
  group: "block",
  content: "block+",
  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
    };
  },
  parseHTML() {
    return [
      {
        tag: "div",
        getAttrs(node: string | globalThis.Node) {
          if (typeof node === "string") return false;
          if ((node as HTMLElement).hasAttribute("data-youtube-video")) return false;
          return null;
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }: HtmlAttributesArg) {
    return ["div", mergeAttributes(HTMLAttributes), 0];
  },
});

export const SectionBlock = Node.create({
  name: "sectionBlock",
  group: "block",
  content: "block+",
  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "section" }];
  },
  renderHTML({ HTMLAttributes }: HtmlAttributesArg) {
    return ["section", mergeAttributes(HTMLAttributes), 0];
  },
});
