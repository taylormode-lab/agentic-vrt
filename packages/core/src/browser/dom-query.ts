/**
 * 指定テキストを含む要素を文書順で全件返す純粋 DOM 関数。
 * jsdom（テスト）・実ブラウザ（page.evaluate）双方で同一の意味論で動くよう、
 * DOM 標準 API（TreeWalker）のみを使う。
 *
 * 重要: 単純なテキスト一致は曖昧になりうる（例: "MRR" が上部 KPI カードと
 * 下部 "MRR推移" 見出しの両方に一致する）。呼び出し側は「全候補」を受け取り、
 * 可視性・位置を見て対象を決める。最初の一致へ盲目的にスクロールしてはならない。
 */
export function findElementsByText(root: Document | Element, text: string): Element[] {
  const doc: Document =
    (root as Element).ownerDocument ?? (root as Document);
  const start: Node = root as Node;
  const walker = doc.createTreeWalker(start, NodeFilter.SHOW_TEXT);
  const out: Element[] = [];
  const seen = new Set<Element>();
  let node: Node | null = walker.nextNode();
  while (node) {
    const content = node.textContent;
    if (content && content.includes(text)) {
      const el = node.parentElement;
      if (el && !seen.has(el)) {
        seen.add(el);
        out.push(el);
      }
    }
    node = walker.nextNode();
  }
  return out;
}
