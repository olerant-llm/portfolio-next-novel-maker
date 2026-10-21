import type { Node, Primitive, Scenario } from "./types.js";

export type RuntimeEvent =
  | { type: "choice"; scene: string; payload: { index: number; text: string }; variables: Record<string, Primitive> }
  | { type: "change"; scene: string; payload: { variable: string; before: Primitive; after: Primitive }; variables: Record<string, Primitive> }
  | { type: "emit"; scene: string; payload: { event: string }; variables: Record<string, Primitive> }
  | { type: "end"; scene: string; payload: Record<string, never>; variables: Record<string, Primitive> };

export type RuntimeOutput = Exclude<Node, { type: "set" | "if" | "else" | "endif" | "jump" }> | { type: "choices"; choices: Extract<Node, { type: "choice" }>[] } | { type: "end" };

export interface Runtime {
  next(): RuntimeOutput | undefined;
  choose(index: number): void;
  getVariables(): Record<string, Primitive>;
  setVariables(values: Record<string, Primitive>): void;
  snapshot(): RuntimeSnapshot;
  restore(snapshot: RuntimeSnapshot): void;
  on(listener: (event: RuntimeEvent) => void): () => void;
}

export interface RuntimeSnapshot {
  scene: string;
  index: number;
  variables: Record<string, Primitive>;
  ended: boolean;
}

function compare(left: Primitive, operator: string, right: Primitive): boolean {
  switch (operator) { case "==": return left === right; case "!=": return left !== right; case ">=": return Number(left) >= Number(right); case "<=": return Number(left) <= Number(right); case ">": return Number(left) > Number(right); case "<": return Number(left) < Number(right); default: return false; }
}

export function createRuntime(ast: Scenario, options: { variables?: Record<string, Primitive> } = {}): Runtime {
  let scene = ast.sceneOrder[0]; let index = 0; let ended = false;
  const variables: Record<string, Primitive> = { ...options.variables };
  const listeners = new Set<(event: RuntimeEvent) => void>();
  const emit = (event: RuntimeEvent) => listeners.forEach((listener) => listener(event));
  const nodes = () => ast.scenes[scene]?.nodes ?? [];
  const jump = (target: string) => { scene = target; index = 0; };
  const value = (variable: string) => variables[variable] ?? 0;
  const skipConditional = () => {
    let depth = 1;
    while (index < nodes().length && depth) { const node = nodes()[index++]; if (node.type === "if") depth++; if (node.type === "endif") depth--; if (depth === 1 && node.type === "else") break; }
  };
  return {
    next() {
      if (ended) return undefined;
      while (index < nodes().length) {
        const node = nodes()[index++];
        if (node.type === "set") { const before = value(node.variable); const after = node.operator === "=" ? node.value : Number(before) + (node.operator === "+=" ? Number(node.value) : -Number(node.value)); variables[node.variable] = after; emit({ type: "change", scene, payload: { variable: node.variable, before, after }, variables: { ...variables } }); continue; }
        if (node.type === "if") { if (!compare(value(node.variable), node.operator, node.value)) skipConditional(); continue; }
        if (node.type === "else") { let depth = 1; while (index < nodes().length && depth) { const next = nodes()[index++]; if (next.type === "if") depth++; if (next.type === "endif") depth--; } continue; }
        if (node.type === "endif") continue;
        if (node.type === "jump") { jump(node.target); continue; }
        if (node.type === "choice") { const choices = [node]; while (index < nodes().length && nodes()[index].type === "choice") choices.push(nodes()[index++] as Extract<Node, { type: "choice" }>); index -= choices.length; return { type: "choices", choices }; }
        if (node.type === "emit") { emit({ type: "emit", scene, payload: { event: node.event }, variables: { ...variables } }); return node; }
        if (node.type === "end") { ended = true; emit({ type: "end", scene, payload: {}, variables: { ...variables } }); return { type: "end" }; }
        return node;
      }
      ended = true; emit({ type: "end", scene, payload: {}, variables: { ...variables } }); return { type: "end" };
    },
    choose(choiceIndex) { const choices: Extract<Node, { type: "choice" }>[] = []; while (nodes()[index]?.type === "choice") choices.push(nodes()[index++] as Extract<Node, { type: "choice" }>); const choice = choices[choiceIndex]; if (!choice) throw new Error("選択肢の番号が正しくありません"); emit({ type: "choice", scene, payload: { index: choiceIndex, text: choice.text }, variables: { ...variables } }); jump(choice.target); },
    getVariables: () => ({ ...variables }),
    setVariables: (values) => Object.assign(variables, values),
    snapshot: () => ({ scene, index, variables: { ...variables }, ended }),
    restore: (snapshot) => {
      if (!ast.scenes[snapshot.scene]) throw new Error(`復元先のシーン '${snapshot.scene}' がありません`);
      if (!Number.isInteger(snapshot.index) || snapshot.index < 0 || snapshot.index > ast.scenes[snapshot.scene].nodes.length) throw new Error("復元位置が正しくありません");
      scene = snapshot.scene; index = snapshot.index; ended = snapshot.ended;
      Object.keys(variables).forEach((key) => delete variables[key]); Object.assign(variables, snapshot.variables);
    },
    on: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
