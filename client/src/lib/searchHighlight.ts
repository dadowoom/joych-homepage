export type SearchHighlightPart = {
  text: string;
  isMatch: boolean;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 검색어를 HTML로 주입하지 않고 React 텍스트 노드와 mark 노드로 나눌 수 있게 합니다.
 * 영문은 대소문자를 구분하지 않으며 화면에는 원문의 글자 모양을 그대로 유지합니다.
 */
export function splitSearchHighlightParts(
  text: string,
  keyword: string,
): SearchHighlightPart[] {
  const query = keyword.trim();
  if (!text || !query) return text ? [{ text, isMatch: false }] : [];

  const pattern = query.split(/\s+/).map(escapeRegExp).join("\\s+");
  const matcher = new RegExp(pattern, "giu");
  const parts: SearchHighlightPart[] = [];
  let cursor = 0;

  let match = matcher.exec(text);
  while (match) {
    const index = match.index;
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), isMatch: false });
    }
    parts.push({ text: match[0], isMatch: true });
    cursor = index + match[0].length;
    match = matcher.exec(text);
  }

  if (cursor === 0) return [{ text, isMatch: false }];
  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), isMatch: false });
  }
  return parts;
}
