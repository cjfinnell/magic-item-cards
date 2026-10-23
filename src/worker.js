// Routes: /i/<slug> card page, /embed/<slug> iframe card, /api/items[/<slug>] JSON.
// Spells: /s/<slug>, /embed/s/<slug>, /api/spells[/<slug>]. Spells get their own paths because
// some names collide with items (Shield).
// Everything else is a static asset from public/.
import ITEMS from "./items.gen.json";
import SPELLS from "./spells.gen.json";
import { esc, page, renderCard, renderSpellCard } from "./card.js";

const BY_SLUG = new Map(ITEMS.map((i) => [i.slug, i]));
const INDEX = ITEMS.map(({ slug, name, rarity, category, attunement }) => ({
  slug, name, rarity, category, attunement,
}));

const SPELL_BY_SLUG = new Map(SPELLS.map((s) => [s.slug, s]));
const SPELL_INDEX = SPELLS.map(({ slug, name, level, school, classes, ritual, concentration }) => ({
  slug, name, level, school, classes, ritual, concentration,
}));

const html = (body, status = 200, extra = {}) =>
  new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600", ...extra },
  });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=3600",
    },
  });

function notFound(slug, kind = "magic item") {
  return html(page({ title: "Not found", body: `<p class="missing">No SRD ${kind} called "${esc(slug)}".</p>` }), 404);
}

// Full page with share box, or a bare embeddable card whose title links back to the full page.
function cardPage(url, { name, render, path, embedPath, back }) {
  if (!embedPath) return html(page({ title: name, body: render({ link: `${url.origin}${path}` }), embed: true }));
  const embedCode = `<iframe src="${url.origin}${embedPath}" width="400" height="500" style="border:0" loading="lazy" title="${esc(name)}"></iframe>`;
  const body = `<main>${render({})}
<section class="share"><label>Embed this card<textarea readonly rows="3">${esc(embedCode)}</textarea></label>
<p><a href="${back[1]}">${back[0]}</a></p></section></main>`;
  return html(page({ title: `${name} - Magic Item Cards`, body }));
}

export function handle(request) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const [route, slug] = parts;

  if (route === "api" && slug === "items") {
    const one = parts[2];
    if (!one) return json(INDEX);
    const item = BY_SLUG.get(one);
    return item ? json(item) : json({ error: "not_found" }, 404);
  }

  if (route === "api" && slug === "spells") {
    const one = parts[2];
    if (!one) return json(SPELL_INDEX);
    const spell = SPELL_BY_SLUG.get(one);
    return spell ? json(spell) : json({ error: "not_found" }, 404);
  }

  const embed = route === "embed";
  const isSpell = route === "s" || (embed && slug === "s");
  const key = embed && isSpell ? parts[2] : slug;
  if ((route === "i" || route === "s" || embed) && key) {
    if (isSpell) {
      const spell = SPELL_BY_SLUG.get(key);
      if (!spell) return notFound(key, "spell");
      const path = `/s/${spell.slug}`;
      return cardPage(url, {
        name: spell.name, render: (o) => renderSpellCard(spell, o), path,
        embedPath: !embed && `/embed${path}`, back: ["All spells", "/#spells"],
      });
    }
    const item = BY_SLUG.get(key);
    if (!item) return notFound(key);
    const path = `/i/${item.slug}`;
    return cardPage(url, {
      name: item.name, render: (o) => renderCard(item, o), path,
      embedPath: !embed && `/embed/${item.slug}`, back: ["All items", "/"],
    });
  }

  return null;
}

export default {
  async fetch(request, env) {
    return handle(request) ?? env.ASSETS.fetch(request);
  },
};
