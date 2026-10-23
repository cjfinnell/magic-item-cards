// One-off: rebuild data/srd/spells.json from the SRD 5.2 PDF ("Spell Descriptions", pp. 107-175).
// The 5e-bits spell JSON drops sentences and flattens tables, so we parse the PDF layout instead.
// Usage: npm i --no-save pdfjs-dist@4 && node scripts/extract-spells.mjs SRD_CC_v5.2.pdf
import { writeFileSync } from "node:fs";

const FIRST_PAGE = 107, LAST_PAGE = 175;
const OUT = new URL("../data/srd/spells.json", import.meta.url);

// Text runs per column, top to bottom, merged into lines.
export async function readLines(path) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({ url: path }).promise;
  const lines = [];
  for (let p = FIRST_PAGE; p <= LAST_PAGE; p++) {
    const page = await doc.getPage(p);
    await page.getOperatorList(); // loads fonts so commonObjs has their real names
    const runs = [[], []];
    for (const it of (await page.getTextContent()).items) {
      const [size, , , , x, y] = it.transform;
      if (!it.str.trim() || y < 40) continue; // skip page footer
      const font = page.commonObjs.get(it.fontName).name.replace(/^\w+\+/, "");
      runs[x < 300 ? 0 : 1].push({ x, y, w: it.width, size: +Math.abs(size).toFixed(1), font, s: it.str });
    }
    for (const col of runs) {
      const rows = [];
      for (const r of col.sort((a, b) => b.y - a.y || a.x - b.x)) {
        const row = rows.find((l) => Math.abs(l.y - r.y) <= 2);
        row ? row.runs.push(r) : rows.push({ y: r.y, runs: [r] });
      }
      for (const row of rows) {
        row.runs.sort((a, b) => a.x - b.x);
        const first = row.runs[0];
        lines.push({ page: p, x: Math.round(first.x), size: first.size, font: first.font, runs: row.runs });
      }
    }
  }
  return lines;
}

// Join runs, adding a space only where the PDF leaves a visible gap.
function joinRuns(runs) {
  let out = "", end = null;
  for (const r of runs) {
    if (end !== null && r.x - end > 1.2 && !/^[.,;:)]/.test(r.s)) out += " ";
    out += r.s;
    end = r.x + r.w;
  }
  return out.replace(/\s+/g, " ").trim();
}

// Join wrapped lines; "dam-" + "age" becomes "damage", "10-" + "foot" becomes "10-foot".
function joinLines(parts) {
  return parts.reduce((acc, s) => {
    if (!acc) return s;
    if (/\d\s?-$/.test(acc)) return acc.replace(/\s?-$/, "-") + s;
    if (/[a-z]\s?-$/.test(acc)) return acc.replace(/\s?-$/, "") + s;
    return acc + " " + s;
  }, "");
}

const isHeading = (l) => l.size === 12 && /^GillSans-SemiBold/.test(l.font);
const isStatTitle = (l) => l.size === 14.6;
const isCaption = (l) => l.size === 10.5;
const isTableHead = (l) => l.size === 9.3;
// Most spells set properties in GillSans 9.5; a few use bold Cambria 10.
const isProp = (l) => /SemiBold$|-Bold$/.test(l.font) && /^(Casting Time|Range|Components?|Duration):/.test(l.runs[0].s);
const isTableRow = (l) => l.size === 9.5 && /^GillSans/.test(l.font) && !isProp(l);
const colStart = (l) => (l.x < 300 ? 63 : 313);
const indented = (l) => l.x - colStart(l) >= 6;

// Group a heading's lines into spells: heading, subtitle, properties, body lines.
export function splitSpells(lines) {
  const spells = [];
  for (const l of lines) {
    if (isHeading(l)) spells.push({ heading: l, lines: [] });
    else if (spells.length) spells.at(-1).lines.push(l);
  }
  return spells;
}

function parseTable(rowsIn, caption) {
  const heads = [];
  const rows = [];
  let cols = null;
  for (const l of rowsIn) {
    if (isTableHead(l)) {
      // A header repeated after a column break: keep the column names, take the new positions.
      if (cols) cols = l.runs.map((r, k) => ({ x: r.x, parts: cols[k]?.parts ?? [r.s] }));
      else heads.push(l);
      continue;
    }
    if (!cols) {
      // Multi-line headers ("Similar / Area"): the widest line sets the columns.
      const base = heads.reduce((a, b) => (b.runs.length > a.runs.length ? b : a));
      cols = base.runs.map((r) => ({ x: r.x, parts: [] }));
      for (const h of heads) for (const r of h.runs) nearest(cols, r.x).parts.push(r.s);
    }
    const cells = cols.map(() => []);
    for (const r of l.runs) cells[colIndex(cols, r.x)].push(r);
    const filled = cells.filter((c) => c.length).length;
    if (cells[0].length && filled > 1 || !rows.length) rows.push(cells.map((c) => [joinRuns(c)].filter(Boolean)));
    else cells.forEach((c, i) => c.length && rows.at(-1)[i].push(joinRuns(c)));
  }
  const columns = cols.map((c) => c.parts.join(" "));
  return { caption, columns, rows: rows.map((r) => r.map(joinLines)) };
}

const nearest = (cols, x) => cols.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
function colIndex(cols, x) {
  let i = 0;
  cols.forEach((c, j) => { if (x >= c.x - 10) i = j; });
  return i;
}

// Side-by-side tables share lines; split each line's runs at the given x boundaries.
function splitSideBySide(lines, starts) {
  return starts.map((x0, i) => lines.map((l) => ({
    ...l,
    runs: l.runs.filter((r) => r.x >= x0 - 10 && (i === starts.length - 1 || r.x < starts[i + 1] - 10)),
  })).filter((l) => l.runs.length));
}

export function tablesFrom(caption, lines) {
  const heads = lines.filter(isTableHead);
  const captions = caption ? caption.runs.map((r) => r.s) : [];
  // Two captions on one line (Temperature | Wind) or a repeated header (1d10 Species 1d10 Species).
  const head = heads[0];
  const names = head.runs.map((r) => r.s);
  const half = names.length / 2;
  const repeated = names.length % 2 === 0 && names.slice(0, half).join() === names.slice(half).join();
  if (captions.length > 1 || repeated) {
    const starts = captions.length > 1 ? caption.runs.map((r) => r.x) : [head.runs[0].x, head.runs[half].x];
    const parts = splitSideBySide(lines, starts).map((ls, i) => parseTable(ls, captions[i] ?? captions[0] ?? ""));
    if (repeated && captions.length < 2) return [{ ...parts[0], rows: [...parts[0].rows, ...parts[1].rows] }];
    return parts;
  }
  return [parseTable(lines, captions[0] ?? "")];
}

function parseStatBlock(lines) {
  const [title, meta, ...rest] = lines;
  const blocks = [];
  const scores = [];
  let para = null;
  for (const l of rest) {
    if (l.size === 6) continue; // MOD / SAVE column labels
    if (l.size === 9.8) {
      // Small-caps ability names come as several runs ("S" "tr"); numbers follow in threes.
      let name = "";
      const nums = [];
      for (const r of l.runs) {
        if (/SC700/.test(r.font)) {
          if (nums.length) { scores.push([name, ...nums.splice(0)]); name = ""; }
          name += r.s;
        } else nums.push(r.s);
      }
      scores.push([name, ...nums]);
      continue;
    }
    if (l.size === 12) {
      blocks.push({ heading: joinRuns(l.runs) });
      para = null;
      continue;
    }
    const startsPara = /Bold/.test(l.font) && !/Italic/.test(l.font) || /BoldItalic/.test(l.font);
    const text = joinRuns(l.runs);
    if (startsPara || !para) {
      para = [text];
      blocks.push(para);
    } else para.push(text);
  }
  const ability = scores.length && {
    table: {
      caption: "",
      columns: ["", "Score", "Mod", "Save"],
      rows: scores.map(([n, ...v]) => [n[0].toUpperCase() + n.slice(1).toLowerCase(), ...v]),
    },
  };
  const out = blocks.map((b) => (Array.isArray(b) ? joinLines(b) : b));
  // Stat lines (AC, HP, Speed) come before the ability table in the book.
  const firstSection = out.findIndex((b) => b.heading);
  const head = firstSection < 0 ? out : out.slice(0, firstSection);
  const tail = firstSection < 0 ? [] : out.slice(firstSection);
  const idx = head.findIndex((b) => /^Speed\b/.test(b));
  const body = [...head.slice(0, idx + 1), ...(ability ? [ability] : []), ...head.slice(idx + 1), ...tail];
  return { statblock: { name: joinRuns(title.runs), meta: joinRuns(meta.runs), body } };
}

function parseBody(lines) {
  const blocks = [];
  let para = null, list = null;
  const flush = () => { para = null; list = null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (isStatTitle(l)) {
      let j = i + 1;
      while (j < lines.length && !(lines[j].size === 10 && /^Cambria/.test(lines[j].font))) j++;
      blocks.push(parseStatBlock(lines.slice(i, j)));
      i = j - 1;
      flush();
      continue;
    }
    if (isCaption(l) || isTableHead(l)) {
      let j = isCaption(l) ? i + 1 : i;
      while (j < lines.length && (isTableHead(lines[j]) || isTableRow(lines[j]))) j++;
      const tables = tablesFrom(isCaption(l) ? l : null, lines.slice(isCaption(l) ? i + 1 : i, j));
      for (const t of tables) {
        const prev = blocks.at(-1);
        // A table split across columns repeats its header without a caption.
        if (!t.caption && prev?.table && prev.table.columns.join() === t.columns.join()) prev.table.rows.push(...t.rows);
        else blocks.push({ table: t });
      }
      i = j - 1;
      flush();
      continue;
    }
    const text = joinRuns(l.runs);
    if (text.startsWith("•")) {
      if (!list) { list = { list: [] }; blocks.push(list); }
      list.list.push([text.replace(/^•\s*/, "")]);
      para = null;
      continue;
    }
    if (list && (l.x - colStart(l) >= 10 || /[a-z0-9]\s?-$/.test(list.list.at(-1).at(-1)))) {
      list.list.at(-1).push(text);
      continue;
    }
    const leadIn = /BoldItalic|Cambria-Bold$/.test(l.runs[0].font) && /\.$/.test(l.runs[0].s.trim());
    // A line after a hyphenated break always continues the paragraph, even at a column or page break.
    if (!para || (indented(l) || leadIn) && !/[a-z0-9]\s?-$/.test(para.at(-1))) {
      list = null;
      para = [text];
      blocks.push(para);
    } else para.push(text);
  }
  return blocks.map((b) => {
    if (Array.isArray(b)) return joinLines(b);
    if (b.list) return { list: b.list.map(joinLines) };
    return b;
  });
}

const slugify = (name) => name.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function parseSpell({ heading, lines }) {
  let name = joinRuns(heading.runs);
  if (/SC700/.test(heading.font)) name = "Acid Splash"; // set in small caps on p107; text runs are unusable
  let i = 0;
  const sub = [];
  while (i < lines.length && !isProp(lines[i])) sub.push(joinRuns(lines[i++].runs));
  const props = {};
  let key = null;
  const open = (t) => (t.match(/\(/g) || []).length > (t.match(/\)/g) || []).length;
  // Casting Time (reaction triggers) and material lists in parentheses can wrap; the body starts after Duration.
  while (i < lines.length && (isProp(lines[i]) || key && key !== "Duration" || key === "Components" && open(props[key]))) {
    const l = lines[i++];
    if (isProp(l)) {
      key = l.runs[0].s.replace(/:$/, "").replace(/^Component$/, "Components");
      props[key] = joinRuns(l.runs.slice(1));
    } else props[key] = joinLines([props[key], joinRuns(l.runs)]);
  }
  const subtitle = joinLines(sub);
  const m = /^(?:Level (\d) (\w+)|(\w+) Cantrip) \((.+)\)$/.exec(subtitle);
  if (!m) throw new Error(`${name}: unexpected subtitle "${subtitle}"`);
  return {
    slug: slugify(name),
    name,
    level: m[1] ? Number(m[1]) : 0,
    school: m[2] ?? m[3],
    classes: m[4].split(/,\s*/),
    subtitle,
    castingTime: props["Casting Time"],
    ritual: /\bRitual\b/.test(props["Casting Time"]),
    range: props.Range,
    components: props.Components,
    duration: props.Duration,
    concentration: /^Concentration/.test(props.Duration),
    body: parseBody(lines.slice(i)),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const path = process.argv[2];
  if (!path) throw new Error("usage: node scripts/extract-spells.mjs <SRD_CC_v5.2.pdf>");
  const spells = splitSpells(await readLines(path)).map(parseSpell);
  writeFileSync(OUT, JSON.stringify(spells, null, 1) + "\n");
  console.log(`wrote ${spells.length} spells to data/srd/spells.json`);
}
