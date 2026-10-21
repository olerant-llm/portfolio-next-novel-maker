export type Primitive = number | string | boolean;

export interface CharacterDefinition {
  name: string;
  expressions: string[];
}

export interface Diagnostic {
  filename: string;
  line: number;
  level: "error" | "warning";
  message: string;
}

export type Node =
  | { type: "dialogue"; line: number; speaker?: string; expression?: string; text: string }
  | { type: "choice"; line: number; text: string; target: string }
  | { type: "set"; line: number; variable: string; operator: "=" | "+=" | "-="; value: Primitive }
  | { type: "if"; line: number; variable: string; operator: string; value: Primitive }
  | { type: "else"; line: number }
  | { type: "endif"; line: number }
  | { type: "jump"; line: number; target: string }
  | { type: "bg"; line: number; background: string }
  | { type: "enter" | "exit"; line: number; character: string; position?: string }
  | { type: "move"; line: number; character: string; position: string }
  | { type: "emit"; line: number; event: string }
  | { type: "end"; line: number };

export interface Scenario {
  metadata: Record<string, string>;
  scenes: Record<string, { id: string; line: number; nodes: Node[] }>;
  sceneOrder: string[];
}

export interface ParseOptions { characters?: CharacterDefinition[]; filename?: string }
export interface ParseResult { ast?: Scenario; errors: Diagnostic[]; warnings: Diagnostic[] }
