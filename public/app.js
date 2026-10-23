// Client-side search over /api/items.
const $ = (id) => document.getElementById(id);
const items = await (await fetch("/api/items")).json();

const baseRarity = (r) => r.replace(/\s*\(.*$/, "").split(",")[0].trim();
for (const [sel, values] of [
  ["rarity", [...new Set(items.map((i) => baseRarity(i.rarity)))]],
  ["category", [...new Set(items.map((i) => i.category))].sort()],
]) {
  for (const v of values) $(sel).append(new Option(v, v));
}

function render() {
  const q = $("q").value.trim().toLowerCase();
  const rarity = $("rarity").value, category = $("category").value, attune = $("attune").value;
  const hits = items.filter((i) =>
    (!q || i.name.toLowerCase().includes(q)) &&
    (!rarity || baseRarity(i.rarity) === rarity) &&
    (!category || i.category === category) &&
    (!attune || String(Number(i.attunement)) === attune));
  $("count").textContent = `${hits.length} of ${items.length} items`;
  $("list").replaceChildren(...hits.map((i) => {
    const li = document.createElement("li");
    const a = Object.assign(document.createElement("a"), { href: `/i/${i.slug}`, textContent: i.name });
    const meta = Object.assign(document.createElement("span"), {
      className: "meta", textContent: `${i.rarity}${i.attunement ? " · attunement" : ""}`,
    });
    li.append(a, meta);
    return li;
  }));
}

for (const id of ["q", "rarity", "category", "attune"]) $(id).addEventListener("input", render);
render();
