/**
 * Extracts meaningful keywords from a text description by:
 * 1. Lowercasing and stripping punctuation
 * 2. Removing stop words (a, the, in, etc.)
 * 3. Applying basic suffix stemming (ies→y, es→, s→, ing→, ed→)
 * 4. Deduplicating the result
 *
 * @param {string} text - Raw item description or name
 * @returns {string[]} Deduplicated array of stemmed keyword tokens
 *
 * @example
 * extractKeywords('Lost black leather wallet near Block A')
 * // → ['black', 'leather', 'wallet', 'block']
 */
export function extractKeywords(text) {
  if (!text) {return [];}

  const stopWords = new Set([
    'a',
    'an',
    'the',
    'in',
    'at',
    'on',
    'near',
    'my',
    'i',
    'was',
    'is',
    'it',
    'and',
    'or',
    'but',
    'found',
    'lost',
    'with',
    'to',
    'for',
    'of',
    'this',
    'that',
    'there',
    'here',
    'some',
    'any',
    'has',
    'have',
    'had',
    'left',
    'dropped',
  ]);

  // Convert to lowercase, replace punctuation with spaces
  const words = text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, ' ')
    .split(/\s+/);

  // Filter out stop words, short words, and apply basic stemming (removing trailing 's', 'es', 'ing', 'ed')
  const keywords = words
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .map((word) => {
      if (word.endsWith('ies')) {return word.slice(0, -3) + 'y';}
      if (word.endsWith('es')) {return word.slice(0, -2);}
      if (word.endsWith('s') && !word.endsWith('ss')) {return word.slice(0, -1);}
      if (word.endsWith('ing')) {return word.slice(0, -3);}
      if (word.endsWith('ed')) {return word.slice(0, -2);}
      return word;
    });

  // Deduplicate
  return [...new Set(keywords)];
}

export function calculateSimilarity(keywords1, keywords2) {
  if (keywords1.length === 0 || keywords2.length === 0) {return 0;}

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  // Also check for partial substring matches (e.g. 'smartwatch' matches 'watch')
  const intersection = new Set();

  for (const w1 of set1) {
    for (const w2 of set2) {
      if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
        intersection.add(w1);
        intersection.add(w2);
      }
    }
  }

  const union = new Set([...set1, ...set2]);

  // Boost score slightly if there are any strong matches, otherwise use standard Jaccard
  return Math.min(1.0, (intersection.size / union.size) * 1.5);
}

export function findMatches(newItem, existingItems, threshold = 0.25) {
  const newKeywords = extractKeywords(`${newItem.item_name} ${newItem.description}`);

  const oppositeStatus = newItem.status === 'lost' ? 'found' : 'lost';

  const matches = [];

  for (const item of existingItems) {
    if (item.status === oppositeStatus) {
      const existingKeywords = extractKeywords(`${item.item_name} ${item.description}`);
      const score = calculateSimilarity(newKeywords, existingKeywords);

      if (score >= threshold) {
        matches.push({ item, score });
      }
    }
  }

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
}
