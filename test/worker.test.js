import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildItems, loadSpells } from "../scripts/build-data.mjs";
import { renderCard, renderSpellCard, rarityClass, subtitle } from "../src/card.js";

const raw = JSON.parse(readFileSync(new URL("../data/srd/5e-SRD-Magic-Items.json", import.meta.url)));
const items = buildItems(raw);
const bySlug = new Map(items.map((i) => [i.slug, i]));
const spells = loadSpells();
const spell = (slug) => spells.find((s) => s.slug === slug);

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

test("every SRD 5.2 spell has level, school, classes and stats", () => {
  assert.equal(spells.length, 339);
  assert.equal(new Set(spells.map((s) => s.slug)).size, 339);
  for (const s of spells) {
    assert.ok(s.level >= 0 && s.level <= 9, `${s.slug} level`);
    assert.ok(s.school && s.classes.length, `${s.slug} school and classes`);
    for (const k of ["castingTime", "range", "components", "duration"]) assert.ok(s[k], `${s.slug} ${k}`);
    assert.ok(s.body.length > 0, `${s.slug} body`);
  }
});

test("spell text comes from the PDF, not the corrupt upstream JSON", () => {
  // Upstream merges Control Weather text into Control Water and drops sentences from Aid.
  assert.ok(!JSON.stringify(spell("control-water")).includes("Precipitation"));
  assert.match(spell("aid").body.join(" "), /Using a Higher-Level Spell Slot\. Each target’s Hit Points increase by 5/);
  assert.equal(spell("shield").castingTime, "Reaction, which you take when you are hit by an attack roll or targeted by the Magic Missile spell");
  assert.equal(spell("acid-splash").level, 0);
  assert.equal(spell("hunters-mark").name, "Hunter’s Mark");
});

test("spell tables keep their rows, including side-by-side tables", () => {
  const weather = spell("control-weather").body.filter((b) => b.table).map((b) => b.table.caption);
  assert.deepEqual(weather, ["Precipitation", "Temperature", "Wind"]);
  const spray = spell("prismatic-spray").body.find((b) => b.table).table;
  assert.equal(spray.rows.length, 8);
  assert.equal(spell("reincarnate").body.find((b) => b.table).table.rows.length, 10);
  const teleport = spell("teleport").body.find((b) => b.table).table;
  assert.deepEqual(teleport.columns, ["Familiarity", "Mishap", "Similar Area", "Off Target", "On Target"]);
  for (const s of spells) {
    for (const b of s.body) {
      if (!b.table) continue;
      for (const r of b.table.rows) assert.equal(r.length, b.table.columns.length, `${s.slug} row width`);
    }
  }
});

test("spell card shows stats, lists and stat blocks", () => {
  const html = renderSpellCard(spell("fireball"));
  assert.match(html, /Level 3 Evocation \(Sorcerer, Wizard\)/);
  assert.match(html, /<strong>Range:<\/strong> 150 feet/);
  assert.match(html, /CC-BY-4.0/);
  assert.match(renderSpellCard(spell("greater-restoration")), /<ul><li>/);
  assert.match(renderSpellCard(spell("find-steed")), /<section class="statblock"><h3>Otherworldly Steed/);
});

test("spell routes: page, embed, API; Shield item and spell both resolve", async () => {
  const get = (p) => handle(new Request("https://cards.example" + p));
  assert.match(await get("/s/fireball").text(), /\/embed\/s\/fireball/);
  const embed = await get("/embed/s/fireball").text();
  assert.match(embed, /href="https:\/\/cards.example\/s\/fireball"/);
  assert.equal((await get("/api/spells").json()).length, 339);
  assert.equal((await get("/api/spells/shield").json()).level, 1);
  assert.equal((await get("/api/items/shield").json()).name, "Shield");
  assert.equal(get("/s/nope").status, 404);
  assert.equal(get("/api/spells/nope").status, 404);
});
