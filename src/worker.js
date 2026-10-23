// Routes: /i/<slug> card page, /embed/<slug> iframe card, /api/items[/<slug>] JSON.
// Everything else is a static asset from public/.
import ITEMS from "./items.gen.json";
import { esc, page, renderCard } from "./card.js";

const BY_SLUG = new Map(ITEMS.map((i) => [i.slug, i]));
const INDEX = ITEMS.map(({ slug, name, rarity, category, attunement }) => ({
  slug, name, rarity, category, attunement,
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

function notFound(slug) {
  return html(page({ title: "Item not found", body: `<p class="missing">No SRD magic item called "${esc(slug)}".</p>` }), 404);
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

  if ((route === "i" || route === "embed") && slug) {
    const item = BY_SLUG.get(slug);
    if (!item) return notFound(slug);
    if (route === "i") {
      const embedCode = `<iframe src="${url.origin}/embed/${item.slug}" width="400" height="500" style="border:0" loading="lazy" title="${esc(item.name)}"></iframe>`;
      const body = `<main>${renderCard(item)}
<section class="share"><label>Embed this card<textarea readonly rows="3">${esc(embedCode)}</textarea></label>
<p><a href="/">All items</a></p></section></main>`;
      return html(page({ title: `${item.name} - Magic Item Cards`, body }));
    }
    // Embed view: framable anywhere, title links back to the full card.
    return html(page({ title: item.name, body: renderCard(item, { link: `${url.origin}/i/${item.slug}` }), embed: true }));
  }

  return null;
}

export default {
  async fetch(request, env) {
    return handle(request) ?? env.ASSETS.fetch(request);
  },
};
