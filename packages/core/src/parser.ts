import type { CharacterDefinition, Diagnostic, Node, ParseOptions, ParseResult, Primitive, Scenario } from "./types.js";

const structuralEscape = new Set(["|", "｜", "《", "》", ":", "：", "(", "（", ")", "）", "*", "＊", "@", "＠", "#", "＃", "/", "／", "-", "→", "\\", "＼", "￥"]);
const sceneId = /^[A-Za-z0-9_]+$/;

function normalized(input: string): string {
  return input.replaceAll("＠", "@").replaceAll("＃", "#").replaceAll("：", ":").replaceAll("＊", "*").replaceAll("（", "(").replaceAll("）", ")").replaceAll("｜", "|").replaceAll("／", "/");
}

function displayText(input: string): string {
  return input.replace(/[\\＼￥]([\\＼￥|｜《》:：()（）*＊@＠#＃/／\-→])/g, (all, next) => structuralEscape.has(next) ? (next === "＼" || next === "￥" ? "＼" : next) : all);
}

function valueOf(raw: string): Primitive {
  const value = raw.trim();
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  const quoted = value.match(/^(?:"([\s\S]*)"|'([\s\S]*)')$/);
  return quoted ? (quoted[1] ?? quoted[2] ?? "") : value;
}

export function parse(text: string, options: ParseOptions = {}): ParseResult {
  const filename = options.filename ?? "scenario";
  const errors: Diagnostic[] = [], warnings: Diagnostic[] = [];
  const error = (line: number, message: string) => errors.push({ filename, line, level: "error", message });
  const warning = (line: number, message: string) => warnings.push({ filename, line, level: "warning", message });
  const ast: Scenario = { metadata: {}, scenes: {}, sceneOrder: [] };
  const characterMap = new Map((options.characters ?? []).map((item) => [item.name, item]));
  const references: { line: number; target: string }[] = [];
  const assigned = new Map<string, { type: string; line: number }>();
  const conditionalReferences: { line: number; variable: string }[] = [];
  let current: Scenario["scenes"][string] | undefined;
  let depth = 0;
  let sawScene = false;

  text.replace(/\r\n?/g, "\n").split("\n").forEach((raw, index) => {
    const line = index + 1;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const syntax = normalized(trimmed);
    if (syntax.startsWith("//")) return;
    const metadata = syntax.match(/^@([A-Za-z][\w-]*)\s*:\s*(.*)$/);
    if (!sawScene && metadata) { ast.metadata[metadata[1]] = metadata[2]; return; }
    const scene = syntax.match(/^#\s*scene\s*:\s*(\S+)\s*$/i);
    if (scene) {
      sawScene = true;
      if (!sceneId.test(scene[1])) error(line, "シーンIDは英数字とアンダースコアだけで指定してください");
      else if (ast.scenes[scene[1]]) error(line, `シーン '${scene[1]}' が重複しています`);
      else { current = { id: scene[1], line, nodes: [] }; ast.scenes[scene[1]] = current; ast.sceneOrder.push(scene[1]); }
      return;
    }
    if (!current) { error(line, "シーン定義の前にはメタヘッダーだけを書けます"); return; }
    const add = (node: Node) => current?.nodes.push(node);
    const choice = syntax.match(/^\*\s*(.*?)\s*(?:->|→)\s*([A-Za-z0-9_]+)\s*$/);
    if (choice) { if (depth) error(line, "@if ブロック内に選択肢は書けません"); references.push({ line, target: choice[2] }); add({ type: "choice", line, text: displayText(choice[1]), target: choice[2] }); return; }
    const command = syntax.match(/^@(\w+)\b\s*(.*)$/);
    if (command) {
      const [, name, rest] = command;
      if (name === "set") {
        const match = rest.match(/^([A-Za-z_]\w*)\s*(=|\+=|-=)\s*(.+)$/);
        if (!match) error(line, "@set は '@set 変数 = 値' の形で書いてください");
        else { const value = valueOf(match[3]); const type = typeof value; const prior = assigned.get(match[1]); if (prior && prior.type !== type) error(line, `変数 '${match[1]}' の型が ${prior.type} と一致しません`); else { assigned.set(match[1], { type, line }); add({ type: "set", line, variable: match[1], operator: match[2] as "=" | "+=" | "-=", value }); } }
      } else if (name === "if") {
        const match = rest.match(/^([A-Za-z_]\w*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
        if (!match) error(line, "@if の条件式が正しくありません");
        else { depth++; if (depth > 3) error(line, "@if のネストは3段までです"); conditionalReferences.push({ line, variable: match[1] }); add({ type: "if", line, variable: match[1], operator: match[2], value: valueOf(match[3]) }); }
      } else if (name === "else") { if (!depth) error(line, "対応する @if がない @else です"); add({ type: "else", line }); }
      else if (name === "endif") { if (!depth) error(line, "対応する @if がない @endif です"); else depth--; add({ type: "endif", line }); }
      else if (name === "jump") { if (!sceneId.test(rest)) error(line, "@jump のシーンIDが正しくありません"); else { references.push({ line, target: rest }); add({ type: "jump", line, target: rest }); } }
      else if (name === "bg") add({ type: "bg", line, background: rest });
      else if (name === "enter") { const m = rest.match(/^(\S+)(?:\s+(left|center|right))?$/); if (!m) error(line, "@enter の書式が正しくありません"); else { if (!characterMap.has(m[1])) error(line, `未定義キャラ '${m[1]}' を指定しています`); add({ type: "enter", line, character: m[1], position: m[2] }); } }
      else if (name === "exit") { if (!rest) error(line, "@exit のキャラ名がありません"); else { if (!characterMap.has(rest)) error(line, `未定義キャラ '${rest}' を指定しています`); add({ type: "exit", line, character: rest }); } }
      else if (name === "move") { const m = rest.match(/^(\S+)\s+(left|center|right)$/); if (!m) error(line, "@move の書式が正しくありません"); else { if (!characterMap.has(m[1])) error(line, `未定義キャラ '${m[1]}' を指定しています`); add({ type: "move", line, character: m[1], position: m[2] }); } }
      else if (name === "emit") { if (!rest) error(line, "@emit のイベント名がありません"); else add({ type: "emit", line, event: rest }); }
      else if (name === "end") add({ type: "end", line });
      else error(line, `未対応の命令 '@${name}' です`);
      return;
    }
    // Keep dialogue text from the original line so full-width symbols displayed in prose stay untouched.
    const dialogue = trimmed.match(/^(?:(.+?)(?:[（(]([^）)]*)[）)])?)?\s*[:：]\s*(.*)$/);
    if (!dialogue) { error(line, "解釈できない行です"); return; }
    const speaker = dialogue[1]?.trim() || undefined;
    const expression = dialogue[2]?.trim() || undefined;
    if (speaker && speaker !== "ナレーション") {
      const character = characterMap.get(speaker);
      if (!character) error(line, `未定義キャラ '${speaker}' の発話です`);
      else if (expression && !character.expressions.includes(expression)) error(line, `キャラ '${speaker}' に表情 '${expression}' はありません`);
    }
    add({ type: "dialogue", line, speaker: speaker === "ナレーション" ? undefined : speaker, expression, text: displayText(dialogue[3]) });
  });
  if (depth) error(text.split(/\r?\n/).length, "@if に対応する @endif がありません");
  if (!ast.sceneOrder.length) error(1, "シーンが1つ以上必要です");
  references.forEach((reference) => { if (!ast.scenes[reference.target]) error(reference.line, `未定義シーン '${reference.target}' を参照しています`); });
  conditionalReferences.forEach((reference) => { if (!assigned.has(reference.variable)) warning(reference.line, `変数 '${reference.variable}' は一度も @set されていません`); });
  const reached = new Set<string>(ast.sceneOrder.length ? [ast.sceneOrder[0]] : []);
  references.forEach((reference) => reached.add(reference.target));
  ast.sceneOrder.forEach((id) => { if (!reached.has(id)) warning(ast.scenes[id].line, `シーン '${id}' は到達不能です`); });
  return { ast: errors.length ? undefined : ast, errors, warnings };
}
