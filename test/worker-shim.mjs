// Node can't import JSON without an attribute; rewrite the import and load the Worker from a data: URL.
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8")
  .replace(/import (\w+) from "\.\/(\w+\.gen\.json)";/g, (_, name, file) =>
    `import ${name} from ${JSON.stringify(new URL(`../src/${file}`, import.meta.url).href)} with { type: "json" };`)
  .replace('from "./card.js"', `from ${JSON.stringify(new URL("../src/card.js", import.meta.url).href)}`);
const mod = await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
export const handle = mod.handle;
