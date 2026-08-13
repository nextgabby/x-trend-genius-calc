/**
 * X search syntax helpers.
 *
 * X does NOT allow a bare AND operator — AND is a space between clauses.
 * OR must be uppercase. Parentheses group expressions.
 * Precedence: AND binds tighter than OR, so OR-groups joined by AND must be parenthesized:
 *   (a OR b) (c OR d)  — not  a OR b c OR d
 */

function formatNegationTerm(term: string): string {
  const inner = term.slice(1);
  if (inner.startsWith('"') && inner.endsWith('"')) return term;
  if (inner.includes(' ')) return `-"${inner}"`;
  return term;
}

function tokenizeQuery(input: string): string[] {
  const src = input.replace(/\s+/g, ' ').trim();
  if (!src) return [];

  const tokens: string[] = [];
  let i = 0;

  while (i < src.length) {
    if (src[i] === ' ') {
      i++;
      continue;
    }

    if (src[i] === '(' || src[i] === ')') {
      tokens.push(src[i]);
      i++;
      continue;
    }

    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length && src[j] !== '"') j++;
      tokens.push(src.slice(i, Math.min(j + 1, src.length)));
      i = j < src.length ? j + 1 : src.length;
      continue;
    }

    // Negation: -term or -"multi word"
    if (src[i] === '-' && i + 1 < src.length && src[i + 1] !== ' ') {
      if (src[i + 1] === '"') {
        let j = i + 2;
        while (j < src.length && src[j] !== '"') j++;
        tokens.push(src.slice(i, Math.min(j + 1, src.length)));
        i = j < src.length ? j + 1 : src.length;
      } else {
        let j = i + 1;
        while (j < src.length && src[j] !== ' ' && src[j] !== '(' && src[j] !== ')') j++;
        tokens.push(src.slice(i, j));
        i = j;
      }
      continue;
    }

    // AND / OR operators (case-insensitive match; OR emitted uppercase)
    const andMatch = src.slice(i).match(/^AND\b/i);
    if (andMatch) {
      tokens.push('AND');
      i += andMatch[0].length;
      continue;
    }
    const orMatch = src.slice(i).match(/^OR\b/i);
    if (orMatch) {
      tokens.push('OR');
      i += orMatch[0].length;
      continue;
    }

    // Leaf term: consume until operator, paren, quote, or negation boundary
    let j = i;
    while (j < src.length) {
      if (src[j] === '(' || src[j] === ')' || src[j] === '"') break;
      if (src[j] === ' ') {
        const rest = src.slice(j + 1);
        if (
          /^AND\b/i.test(rest) ||
          /^OR\b/i.test(rest) ||
          rest.startsWith('(') ||
          rest.startsWith(')') ||
          // Negation terms are separate tokens: "Jordan -scandal"
          (rest.startsWith('-') && rest.length > 1 && rest[1] !== ' ')
        ) {
          break;
        }
      }
      j++;
    }
    const term = src.slice(i, j).trim();
    if (term) tokens.push(term);
    i = j;
  }

  return tokens;
}

function joinTokens(tokens: string[]): string {
  let out = '';
  for (let t = 0; t < tokens.length; t++) {
    const tok = tokens[t];
    const prev = tokens[t - 1];
    if (t === 0) {
      out = tok;
    } else if (tok === ')') {
      out += tok;
    } else if (prev === '(') {
      out += tok;
    } else {
      // includes ") (" → space between groups
      out += ` ${tok}`;
    }
  }
  return out;
}

function hasTopLevelOr(tokens: string[]): boolean {
  let depth = 0;
  for (const tok of tokens) {
    if (tok === '(') depth++;
    else if (tok === ')') depth--;
    else if (tok === 'OR' && depth === 0) return true;
  }
  return false;
}

function isFullyParenthesized(tokens: string[]): boolean {
  if (tokens.length < 2 || tokens[0] !== '(' || tokens[tokens.length - 1] !== ')') {
    return false;
  }
  let depth = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i] === '(') depth++;
    else if (tokens[i] === ')') depth--;
    if (depth === 0 && i < tokens.length - 1) return false;
  }
  return depth === 0;
}

function splitTopLevelAnd(tokens: string[]): string[][] {
  const clauses: string[][] = [];
  let current: string[] = [];
  let depth = 0;

  for (const tok of tokens) {
    if (tok === '(') depth++;
    if (tok === ')') depth = Math.max(0, depth - 1);

    if (tok === 'AND' && depth === 0) {
      if (current.length) clauses.push(current);
      current = [];
      continue;
    }
    current.push(tok);
  }
  if (current.length) clauses.push(current);
  return clauses;
}

/**
 * Normalize a query for the X search API:
 * - Quote multi-word phrases (when quoteMultiWord is true — exact-keywords mode)
 * - Convert bare AND to implicit AND (space)
 * - Parenthesize OR-groups that are AND-joined so precedence stays correct
 * - Keep OR, parentheses, negations, and keyword text
 */
export function normalizeExactQuery(
  input: string,
  options: { quoteMultiWord?: boolean } = {}
): string {
  const quoteMultiWord = options.quoteMultiWord !== false;
  const rawTokens = tokenizeQuery(input);
  if (rawTokens.length === 0) return '';

  const tokens = rawTokens.map((tok) => {
    if (tok === 'AND' || tok === 'OR' || tok === '(' || tok === ')') return tok;
    if (tok.startsWith('-') || tok.startsWith('"') || tok.startsWith('#')) return tok;
    if (quoteMultiWord && tok.includes(' ')) return `"${tok}"`;
    return tok;
  });

  // Trailing negations stay at the end (not part of AND/OR structure)
  const negations: string[] = [];
  while (tokens.length > 0 && tokens[tokens.length - 1].startsWith('-')) {
    negations.unshift(formatNegationTerm(tokens.pop()!));
  }

  const clauses = splitTopLevelAnd(tokens);
  const rendered = clauses.map((clause) => {
    if (clause.length === 0) return '';
    const needsParens = hasTopLevelOr(clause) && !isFullyParenthesized(clause);
    const body = joinTokens(clause);
    return needsParens ? `(${body})` : body;
  }).filter(Boolean);

  let out = rendered.join(' ');
  if (negations.length > 0) {
    out = out ? `${out} ${negations.join(' ')}` : negations.join(' ');
  }
  return out;
}

/** Safety net: fix invalid AND / grouping without re-quoting terms. */
export function ensureXQuerySyntax(query: string): string {
  if (!query?.trim()) return query;
  if (!/\bAND\b/i.test(query)) {
    // Still parenthesize ambiguous OR+space patterns? Skip if no AND — leave working queries alone.
    return query.trim();
  }
  return normalizeExactQuery(query, { quoteMultiWord: false });
}
