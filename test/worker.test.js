import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildItems } from "../scripts/build-data.mjs";
import { renderCard, rarityClass, subtitle } from "../src/card.js";

const raw = JSON.parse(readFileSync(new URL("../data/srd/5e-SRD-Magic-Items.json", import.meta.url)));
const items = buildItems(raw);
const bySlug = new Map(items.map((i) => [i.slug, i]));

// The Worker imports JSON with a bundler-only syntax, so load it through a shim here.
const { handle } = await import("./worker-shim.mjs");

test("builds every SRD item with a type line and body", () => {
  assert.equal(items.length, raw.length);
  for (const i of items) {
    assert.ok(i.type, `${i.slug} has a type`);
    assert.ok(i.body.length > 0, `${i.slug} has body text`);
  }
});

test("variants point back to their parent", () => {
  assert.equal(bySlug.get("weapon-2").variantOf, "weapon");
  assert.deepEqual(bySlug.get("weapon").variants, ["weapon-1", "weapon-2", "weapon-3"]);
});

test("variant bodies drop the repeated rarity line", () => {
  assert.match(bySlug.get("weapon-2").body[0], /^You have a \+2 bonus/);
  assert.match(bySlug.get("horn-of-valhalla-2").body[0], /^\S.*\./);
});

test("subtitle shows rarity and attunement", () => {
  assert.equal(subtitle(bySlug.get("bag-of-holding")), "Wondrous Item, Uncommon");
  const holy = items.find((i) => i.limitedTo === "Paladin");
  assert.match(subtitle(holy), /requires attunement by a Paladin/);
});

test("rarity class maps compound rarities to their first tier", () => {
  assert.equal(rarityClass("Very Rare (+3)"), "r-very-rare");
  assert.equal(rarityClass("Rare (+1), Very Rare (+2), or Legendary (+3)"), "r-rare");
  assert.equal(rarityClass("Rarity Varies"), "r-varies");
});

test("card escapes HTML and carries the CC-BY attribution", () => {
  const html = renderCard({ ...bySlug.get("bag-of-holding"), name: "<script>x</script>" });
  assert.ok(!html.includes("<script>x"));
  assert.match(html, /CC-BY-4.0/);
});

test("routes: card page, embed, API, 404, passthrough", async () => {
  const get = (p) => handle(new Request("https://cards.example" + p));
  const page = get("/i/bag-of-holding");
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Embed this card/);
  const embed = await get("/embed/bag-of-holding").text();
  assert.match(embed, /class="embed"/);
  assert.match(embed, /href="https:\/\/cards.example\/i\/bag-of-holding"/);
  const list = await get("/api/items").json();
  assert.equal(list.length, raw.length);
  assert.equal((await get("/api/items/bag-of-holding").json()).name, "Bag of Holding");
  assert.equal(get("/i/nope").status, 404);
  assert.equal(get("/api/items/nope").status, 404);
  assert.equal(get("/"), null);
});

test("table overrides replace flattened source text", () => {
  const wand = bySlug.get("wand-of-wonder");
  const t = wand.body.find((b) => b.table).table;
  assert.deepEqual(t.columns, ["1d100", "Effect"]);
  assert.equal(t.rows[0][0], "01–20");
  assert.equal(t.rows.at(-1)[0], "98–00");
  for (const i of items) {
    for (const b of i.body) {
      if (typeof b === "string") continue;
      for (const r of b.table.rows) assert.equal(r.length, b.table.columns.length, `${i.slug} row width`);
    }
  }
});

test("cards render tables as HTML tables", () => {
  const html = renderCard(bySlug.get("efreeti-bottle"));
  assert.match(html, /<table><thead><tr><th>1d10<\/th><th>Effect<\/th>/);
  assert.equal((html.match(/<tr>/g) ?? []).length, 4);
});
