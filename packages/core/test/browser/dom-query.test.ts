// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { findElementsByText } from "../../src/browser/dom-query.js";

describe("findElementsByText", () => {
  it("ページ上部のラベルと下部の見出しの両方に一致するテキストを全件返す（曖昧一致の検出）", () => {
    document.body.innerHTML = `
      <section id="cards"><div class="label">MRR</div><div>¥193,334</div></section>
      <section id="charts"><h3>MRR推移</h3><canvas></canvas></section>
    `;
    const hits = findElementsByText(document, "MRR");
    // "MRR"(上部ラベル) と "MRR推移"(下部見出し) の2要素に一致する
    const texts = hits.map((el) => el.textContent?.trim());
    expect(texts).toContain("MRR");
    expect(texts).toContain("MRR推移");
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("一意な見出しテキストは1件だけ返す", () => {
    document.body.innerHTML = `<h3>MRR推移</h3><h3>売上推移</h3>`;
    const hits = findElementsByText(document, "MRR推移");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.textContent).toBe("MRR推移");
  });

  it("一致が無ければ空配列", () => {
    document.body.innerHTML = `<p>hello</p>`;
    expect(findElementsByText(document, "存在しない")).toEqual([]);
  });
});
