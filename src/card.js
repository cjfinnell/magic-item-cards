// HTML rendering for item cards. Shared by the full page and the embed view.

export const ATTRIBUTION =
  'Includes material from the System Reference Document 5.2 by Wizards of the Coast LLC, ' +
  'licensed under <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener">CC-BY-4.0</a>.';

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

export function rarityClass(rarity) {
  const r = rarity.toLowerCase();
  for (const k of ["artifact", "legendary", "very rare", "rare", "uncommon", "common"]) {
    if (r.startsWith(k)) return "r-" + k.replace(" ", "-");
  }
  return "r-varies";
}

export function subtitle(item) {
  let s = `${item.type}, ${item.rarity}`;
  if (item.attunement) {
    s += item.limitedTo ? ` (requires attunement by a ${item.limitedTo})` : " (requires attunement)";
  }
  return s;
}

// Bold "Name." property lead-ins like "Curse." or "Metal Shell." at the start of a paragraph.
function para(text) {
  const m = /^([A-Z][\w' -]{1,40}\.)\s(.*)$/s.exec(text);
  if (m && m[1].split(" ").length <= 5) return `<p><strong>${esc(m[1])}</strong> ${esc(m[2])}</p>`;
  return `<p>${esc(text)}</p>`;
}

function table({ caption, columns, rows }) {
  const head = columns.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("");
  const cap = caption ? `<caption>${esc(caption)}</caption>` : "";
  return `<table>${cap}<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function block(b) {
  return typeof b === "string" ? para(b) : table(b.table);
}

export function renderCard(item, { link } = {}) {
  const title = link
    ? `<a href="${esc(link)}" target="_blank" rel="noopener">${esc(item.name)}</a>`
    : esc(item.name);
  return `<article class="card ${rarityClass(item.rarity)}">
  <header><h2>${title}</h2><p class="sub">${esc(subtitle(item))}</p></header>
  <div class="body">${item.body.map(block).join("")}</div>
  <footer>${ATTRIBUTION}</footer>
</article>`;
}

export function page({ title, body, embed = false }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/card.css">
</head><body class="${embed ? "embed" : "full"}">
${body}
</body></html>`;
}
