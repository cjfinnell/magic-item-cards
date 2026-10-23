// Turn the vendored SRD 5.2 magic item data into the slim shape the Worker serves.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("../data/srd/5e-SRD-Magic-Items.json", import.meta.url);
const OUT = new URL("../src/items.gen.json", import.meta.url);

const RARITY_LINE = /^(Common|Uncommon|Rare|Very Rare|Legendary|Artifact)\b[^.]{0,30}$/;

export function slimItem(raw) {
  const lines = raw.desc.split("\n").map((l) => l.trim()).filter(Boolean);
  const [typeLine, ...rest] = lines;
  // Variant entries repeat their rarity as a bare first line, e.g. "Rare (Brass)".
  const body = RARITY_LINE.test(rest[0] ?? "") ? rest.slice(1) : rest;
  return {
    slug: raw.index,
    name: raw.name,
    type: typeLine,
    category: raw.equipment_category?.name ?? "",
    rarity: raw.rarity?.name ?? "",
    attunement: Boolean(raw.attunement),
    limitedTo: raw["limited-to"] ?? null,
    variantOf: null,
    variants: (raw.variants ?? []).map((v) => v.index),
    body,
  };
}

export function buildItems(rawItems) {
  const items = rawItems.map(slimItem);
  const bySlug = new Map(items.map((i) => [i.slug, i]));
  for (const parent of items) {
    for (const child of parent.variants) {
      if (bySlug.has(child)) bySlug.get(child).variantOf = parent.slug;
    }
  }
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const items = buildItems(JSON.parse(readFileSync(SRC, "utf8")));
  writeFileSync(OUT, JSON.stringify(items));
  console.log(`wrote ${items.length} items to src/items.gen.json`);
}
