import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import logger from './logger.js';

/**
 * Institution search engine.
 *
 * Architecture (hybrid, designed to scale to the full AICTE/UGC corpus):
 *  - A normalized in-memory index is built once at boot from a JSON dataset.
 *  - Matching combines exact alias hits, derived acronyms (so "IITD", "RVCE",
 *    "NITK" resolve without hand-listing every form), prefix/substring, and a
 *    subsequence fuzzy fallback for typo tolerance.
 *  - The route layer caches popular queries in Redis.
 *
 * SCALING TO 10k–50k INSTITUTIONS:
 *  Drop the full AICTE / UGC / NIRF export (same { name, city, state, type,
 *  aliases } shape) into institutions.json — the index build is O(n) and a few
 *  tens of thousands of rows stay well under ~10 MB and a few ms per query. If
 *  the corpus grows beyond that or needs ranking by popularity, promote this to
 *  a dedicated search index (Postgres `pg_trgm` / Meilisearch / Typesense)
 *  behind the same searchInstitutions() contract — callers won't change.
 */

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = join(__dirname, '..', 'data', 'institutions.json');

// Tokens that should not contribute to a derived acronym (so "Indian Institute
// of Technology Delhi" -> "iitd", not "iiotd").
const ACRONYM_STOPWORDS = new Set(['of', 'and', 'the', 'for', 'in', 'at', '&']);

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalize(value).split(' ').filter(Boolean);
}

function deriveAcronym(name) {
  return tokenize(name)
    .filter((t) => !ACRONYM_STOPWORDS.has(t))
    .map((t) => t[0])
    .join('');
}

/** True if every char of `needle` appears in `haystack` in order (fuzzy). */
function isSubsequence(needle, haystack) {
  let i = 0;
  for (let j = 0; j < haystack.length && i < needle.length; j++) {
    if (haystack[j] === needle[i]) {i++;}
  }
  return i === needle.length;
}

let INDEX = [];

function buildIndex() {
  let raw = [];
  try {
    raw = JSON.parse(readFileSync(DATA_PATH, 'utf-8'));
  } catch (err) {
    logger.error(`Failed to load institutions dataset: ${err.message}`);
    raw = [];
  }
  INDEX = raw.map((inst) => {
    const normName = normalize(inst.name);
    const aliasNorms = (inst.aliases || []).map(normalize);
    return {
      name: inst.name,
      city: inst.city,
      state: inst.state,
      type: inst.type,
      _name: normName,
      _nameCompact: normName.replace(/ /g, ''),
      _city: normalize(inst.city),
      _state: normalize(inst.state),
      _aliases: aliasNorms,
      _aliasCompact: aliasNorms.map((a) => a.replace(/ /g, '')),
      _acronym: deriveAcronym(inst.name),
    };
  });
  logger.info(`Institution index built: ${INDEX.length} entries`);
}

/**
 * Score a single indexed record against a query. Higher is better; 0 means no
 * match. Tiers run from exact name/alias hits down to a fuzzy subsequence
 * fallback so typos like "banglore" still resolve.
 *
 * @param rec  indexed institution record
 * @param nq   normalized, space-separated query
 * @param cq   compact query (spaces stripped)
 */
function score(rec, nq, cq) {
  let best = 0;
  const consider = (s) => {
    if (s > best) {best = s;}
  };

  // Exact full-name or alias match.
  if (rec._name === nq) {consider(100);}
  if (rec._aliases.includes(nq)) {consider(98);}

  // Derived acronym (e.g. "iitd", "rvce", "nitk").
  if (rec._acronym && rec._acronym === cq) {consider(95);}
  if (rec._acronym && cq.length >= 2 && rec._acronym.startsWith(cq)) {consider(88);}
  if (rec._acronym && cq.length >= 2 && rec._acronym.includes(cq)) {consider(85);}
  if (rec._acronym && cq.length >= 3 && isSubsequence(cq, rec._acronym)) {consider(75);}

  // Prefix match on the compact name or an alias.
  if (rec._nameCompact.startsWith(cq)) {consider(80);}
  if (rec._aliasCompact.some((a) => a.startsWith(cq))) {consider(78);}

  // Any individual word of the name starts with the query.
  if (rec._name.split(' ').some((t) => t.startsWith(nq))) {consider(70);}

  // Substring match on name / city / alias.
  if (rec._nameCompact.includes(cq)) {consider(60);}
  if (rec._city && rec._city.startsWith(nq)) {consider(55);}
  if (rec._aliasCompact.some((a) => a.includes(cq))) {consider(52);}

  // Fuzzy subsequence fallback (typo tolerance) for longer queries only.
  if (cq.length >= 3 && isSubsequence(cq, rec._nameCompact)) {consider(40);}
  if (cq.length >= 3 && rec._aliasCompact.some((a) => isSubsequence(cq, a))) {consider(38);}

  return best;
}

/**
 * Public search contract. Returns up to `limit` best-matching institutions in
 * the `{ name, city, state, type }` shape the demo/onboarding UI renders.
 */
export function searchInstitutions(query, limit = 8) {
  const nq = normalize(query);
  const cq = nq.replace(/ /g, '');
  if (cq.length < 1) {return [];}

  const scored = [];
  for (const rec of INDEX) {
    const s = score(rec, nq, cq);
    if (s > 0) {scored.push({ rec, s });}
  }

  scored.sort(
    (a, b) =>
      b.s - a.s ||
      a.rec._name.length - b.rec._name.length ||
      a.rec._name.localeCompare(b.rec._name)
  );

  return scored.slice(0, Math.max(1, limit)).map(({ rec }) => ({
    name: rec.name,
    city: rec.city,
    state: rec.state,
    type: rec.type,
  }));
}

buildIndex();

/** Total number of institutions currently indexed. */
export const institutionCount = INDEX.length;