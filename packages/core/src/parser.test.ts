import { describe, expect, it } from "vitest";
import { parse } from "./index.js";

const characters = [
  { name: "アミ", expressions: ["ふつう", "笑顔"] },
  { name: "タケル", expressions: ["ふつう", "怒り"] },
];

describe("parse", () => {
  it("accepts full-width syntax and normalizes only structural symbols", () => {
    const result = parse("＠title： t\n＃ scene： main\nアミ（笑顔）： ＊は本文\n＊ 選ぶ → end\n＃ scene： end\n＠end", { characters });
    expect(result.errors).toEqual([]);
    expect(result.ast?.scenes.main.nodes[0]).toMatchObject({ type: "dialogue", speaker: "アミ", expression: "笑顔", text: "＊は本文" });
  });

  it("unescapes half-width, full-width, and yen escapes in displayed text", () => {
    const result = parse("@title: t\n# scene: main\nアミ: \\| ＼《 ￥@ ＼＼ ￥500\n@end", { characters });
    expect(result.errors).toEqual([]);
    expect(result.ast?.scenes.main.nodes[0]).toMatchObject({ text: "| 《 @ ＼ ￥500" });
  });

  it("collects reference and conditional-choice errors together", () => {
    const result = parse("@title: t\n# scene: main\n名無し(怒り): x\n@jump missing\n@if score >= 1\n* x -> absent\n", { characters, filename: "bad.txt" });
    expect(result.errors.map((item) => item.message)).toEqual(expect.arrayContaining([
      expect.stringContaining("未定義キャラ"),
      expect.stringContaining("未定義シーン"),
      expect.stringContaining("@if ブロック内"),
      expect.stringContaining("@endif"),
    ]));
  });
});
