import { describe, expect, it } from "vitest";
import { createRuntime, parse } from "./index.js";

describe("runtime", () => {
  it("moves through choices, changes variables, emits, and ends", () => {
    const parsed = parse("@title: t\n# scene: main\n* go -> end\n# scene: end\n@set score += 1\n@emit result\n@end");
    if (!parsed.ast) throw new Error("fixture must parse");
    const runtime = createRuntime(parsed.ast);
    const events: string[] = [];
    runtime.on((event) => events.push(event.type));
    expect(runtime.next()).toMatchObject({ type: "choices" });
    runtime.choose(0);
    expect(runtime.next()).toMatchObject({ type: "emit", event: "result" });
    expect(runtime.getVariables()).toEqual({ score: 1 });
    expect(runtime.next()).toEqual({ type: "end" });
    expect(events).toEqual(["choice", "change", "emit", "end"]);
  });

  it("restores scene position, variables, and end state from a snapshot", () => {
    const parsed = parse("@title: t\n# scene: main\n@set score += 1\n: saved point\n@end");
    if (!parsed.ast) throw new Error("fixture must parse");
    const runtime = createRuntime(parsed.ast);
    runtime.next();
    const snapshot = runtime.snapshot();
    expect(snapshot).toMatchObject({ scene: "main", index: 2, variables: { score: 1 }, ended: false });
    runtime.next();
    expect(runtime.snapshot().ended).toBe(true);
    runtime.restore(snapshot);
    expect(runtime.getVariables()).toEqual({ score: 1 });
    expect(runtime.next()).toEqual({ type: "end" });
  });
});
