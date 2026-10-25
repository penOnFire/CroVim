export interface TextSegment { node: Text; start: number; end: number }
export interface TextIndex { text: string; segments: TextSegment[] }

export function buildTextIndex(root: Node = document.body): TextIndex {
  const segments: TextSegment[] = []; let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const textNode = node as Text; const value = textNode.data;
    if (!value) continue;
    const start = text.length; text += value; segments.push({ node: textNode, start, end: text.length });
  }
  return { text, segments };
}

export function rangeForOffsets(index: TextIndex, start: number, end: number): Range | null {
  const from = index.segments.find((s) => start >= s.start && start <= s.end);
  const to = index.segments.find((s) => end >= s.start && end <= s.end);
  if (!from || !to) return null;
  const range = document.createRange();
  range.setStart(from.node, Math.max(0, start - from.start)); range.setEnd(to.node, Math.max(0, end - to.start));
  return range;
}

export function searchIndex(index: TextIndex, query: string, regex = false, smartCase = true): Array<[number, number]> {
  if (!query) return [];
  const flags = smartCase && query.toLowerCase() === query ? 'gi' : 'g';
  try {
    const expression = regex ? new RegExp(query, flags) : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
    return [...index.text.matchAll(expression)].flatMap((m) => m.index === undefined ? [] : [[m.index, m.index + m[0].length]]);
  } catch { return []; }
}
