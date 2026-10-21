import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { parse } from "./parser.js";
import type { CharacterDefinition, Diagnostic } from "./types.js";

async function loadCharacters(paths: string[]): Promise<CharacterDefinition[]> {
  return Promise.all(paths.map(async (path) => {
    const data = parseYaml(await readFile(path, "utf8")) as { name?: string; expressions?: Record<string, string> };
    if (!data.name) throw new Error(`${path}: name がありません`);
    return { name: data.name, expressions: Object.keys(data.expressions ?? {}) };
  }));
}
function print(item: Diagnostic): void { console.error(`${item.filename}:${item.line}: ${item.level}: ${item.message}`); }
const args = process.argv.slice(2).filter((value) => value !== "--");
const separator = args.indexOf("--characters");
const scenarioPaths = separator < 0 ? args : args.slice(0, separator);
const characterPaths = separator < 0 ? [] : args.slice(separator + 1);
if (!scenarioPaths.length) { console.error("使い方: pnpm lint <台本...> --characters <キャラYAML...>"); process.exitCode = 2; }
else {
  const characters = await loadCharacters(characterPaths); let hasErrors = false;
  for (const path of scenarioPaths) { const result = parse(await readFile(resolve(path), "utf8"), { characters, filename: basename(path) }); result.errors.forEach(print); result.warnings.forEach(print); hasErrors ||= result.errors.length > 0; }
  process.exitCode = hasErrors ? 1 : 0;
}
