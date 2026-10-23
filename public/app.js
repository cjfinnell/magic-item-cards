// Client-side search over /api/items and /api/spells. The kind toggle swaps the filter set.
const $ = (id) => document.getElementById(id);
const [items, spells] = await Promise.all(["/api/items", "/api/spells"].map(async (u) => (await fetch(u)).json()));

const baseRarity = (r) => r.replace(/\s*\(.*$/, "").split(",")[0].trim();
const levelName = (l) => (l === 0 ? "Cantrip" : `Level ${l}`);
const fill = (sel, values, label = (v) => v) => {
  for (const v of values) $(sel).append(new Option(label(v), v));
};
fill("rarity", [...new Set(items.map((i) => baseRarity(i.rarity)))]);
fill("category", [...new Set(items.map((i) => i.category))].sort());
fill("level", [...new Set(spells.map((s) => s.level))].sort((a, b) => a - b), levelName);
fill("school", [...new Set(spells.map((s) => s.school))].sort());
fill("class", [...new Set(spells.flatMap((s) => s.classes))].sort());

// Start on spells when linked as /#spells (the "All spells" link on spell cards).
if (location.hash === "#spells") $("kind").value = "spells";

function itemHits(q) {
  const rarity = $("rarity").value, category = $("category").value, attune = $("attune").value;
  return items.filter((i) =>
    (!q || i.name.toLowerCase().includes(q)) &&
    (!rarity || baseRarity(i.rarity) === rarity) &&
    (!category || i.category === category) &&
    (!attune || String(Number(i.attunement)) === attune))
    .map((i) => [`/i/${i.slug}`, i.name, `${i.rarity}${i.attunement ? " · attunement" : ""}`]);
}

function spellHits(q) {
  const level = $("level").value, school = $("school").value, cls = $("class").value;
  return spells.filter((s) =>
    (!q || s.name.toLowerCase().includes(q)) &&
    (!level || String(s.level) === level) &&
    (!school || s.school === school) &&
    (!cls || s.classes.includes(cls)))
    .map((s) => [`/s/${s.slug}`, s.name,
      `${levelName(s.level)} ${s.school}${s.ritual ? " · ritual" : ""}${s.concentration ? " · conc." : ""}`]);
}

function render() {
  const isSpells = $("kind").value === "spells";
  $("item-filters").hidden = isSpells;
  $("spell-filters").hidden = !isSpells;
  $("q").placeholder = isSpells ? "Search spells, e.g. fireball" : "Search items, e.g. bag of holding";
  const q = $("q").value.trim().toLowerCase();
  const hits = isSpells ? spellHits(q) : itemHits(q);
  const total = isSpells ? spells.length : items.length;
  $("count").textContent = `${hits.length} of ${total} ${isSpells ? "spells" : "items"}`;
  $("list").replaceChildren(...hits.map(([href, name, metaText]) => {
    const li = document.createElement("li");
    const a = Object.assign(document.createElement("a"), { href, textContent: name });
    const meta = Object.assign(document.createElement("span"), { className: "meta", textContent: metaText });
    li.append(a, meta);
    return li;
  }));
}

for (const id of ["q", "kind", "rarity", "category", "attune", "level", "school", "class"]) $(id).addEventListener("input", render);
render();
