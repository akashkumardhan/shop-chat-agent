/**
 * Integration test: run the *live* Shopify Storefront MCP schemas through
 * `sanitizeSchemaForGemini` and assert no Gemini-incompatible JSON-Schema
 * keywords remain anywhere in the tree.
 *
 * The fixture `tests/fixtures/shopify-storefront-tools.json` is a snapshot
 * of `tools/list` from a real Shopify storefront MCP endpoint
 * (pe-testing-1.myshopify.com). Refresh it by re-running:
 *
 *   curl -s -X POST https://<shop>/api/mcp \
 *     -H "Content-Type: application/json" \
 *     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
 *     -o tests/fixtures/shopify-storefront-tools.json
 *
 * This guards against three regressions:
 *   1. Shopify adds a new keyword our sanitizer doesn't know about → caught here
 *   2. Our sanitizer accidentally over-strips a valid keyword → caught here
 *   3. Our sanitizer mutates the source → caught by the snapshot check
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { sanitizeSchemaForGemini } from '../../app/services/gemini.server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, '..', 'fixtures', 'shopify-storefront-tools.json');

// Keep in sync with GEMINI_INCOMPATIBLE_KEYWORDS in app/services/gemini.server.js
const INCOMPATIBLE = new Set([
  'additionalProperties',
  'patternProperties',
  'unevaluatedProperties',
  'dependentSchemas',
  'dependentRequired',
  '$schema',
  '$id',
  '$ref',
  '$defs',
  'definitions',
  'if',
  'then',
  'else',
  'not',
  'allOf',
  'oneOf',
]);

/** Recursively collect dot-paths of every node whose key is in INCOMPATIBLE. */
function findIncompatibleKeywords(node, path = '', hits = []) {
  if (node === null || typeof node !== 'object') return hits;
  if (Array.isArray(node)) {
    node.forEach((v, i) => findIncompatibleKeywords(v, `${path}[${i}]`, hits));
    return hits;
  }
  for (const [k, v] of Object.entries(node)) {
    const next = path ? `${path}.${k}` : k;
    if (INCOMPATIBLE.has(k)) hits.push(next);
    findIncompatibleKeywords(v, next, hits);
  }
  return hits;
}

describe('sanitizeSchemaForGemini — live Shopify MCP fixture', () => {
  const live = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  const tools = live.result.tools;

  it('the fixture itself contains incompatible keywords (sanity check — otherwise the test is meaningless)', () => {
    let totalHits = 0;
    for (const t of tools) {
      const schema = t.inputSchema || t.input_schema || {};
      totalHits += findIncompatibleKeywords(schema).length;
    }
    expect(totalHits).toBeGreaterThan(0);
  });

  it.each(tools)('sanitizes "$name" with zero incompatible keywords remaining', (tool) => {
    const schema = tool.inputSchema || tool.input_schema || {};
    const sanitised = sanitizeSchemaForGemini(schema);
    const hits = findIncompatibleKeywords(sanitised);
    expect(hits, `incompatible keywords still present in ${tool.name}: ${hits.join(', ')}`).toEqual([]);
  });

  it('does not mutate the live schemas (the live tool registry must stay intact for Claude path)', () => {
    const before = JSON.stringify(live);
    for (const t of tools) {
      sanitizeSchemaForGemini(t.inputSchema || t.input_schema || {});
    }
    const after = JSON.stringify(live);
    expect(after).toEqual(before);
  });

  /**
   * Find every `required` that violates Gemini's rules:
   *   - required on a non-object schema, OR
   *   - required[N] not present in properties
   */
  function findInvalidRequired(node, path = '', hits = []) {
    if (node === null || typeof node !== 'object') return hits;
    if (Array.isArray(node)) {
      node.forEach((v, i) => findInvalidRequired(v, `${path}[${i}]`, hits));
      return hits;
    }
    if (Array.isArray(node.required)) {
      if (node.type !== 'object') {
        hits.push(`${path}.required (on type=${node.type})`);
      } else {
        const props = Object.keys(node.properties || {});
        const missing = node.required.filter((n) => !props.includes(n));
        if (missing.length > 0) {
          hits.push(`${path}.required missing in properties: ${missing.join(',')}`);
        }
      }
    }
    for (const [k, v] of Object.entries(node)) {
      const next = path ? `${path}.${k}` : k;
      findInvalidRequired(v, next, hits);
    }
    return hits;
  }

  it('the fixture itself contains malformed `required` arrays (sanity check)', () => {
    let totalHits = 0;
    for (const t of tools) {
      const schema = t.inputSchema || t.input_schema || {};
      totalHits += findInvalidRequired(schema).length;
    }
    // We confirmed update_cart has 3 malformed required arrays (add_items,
    // update_items, remove_line_ids — each type=array with required=['items']).
    expect(totalHits).toBeGreaterThanOrEqual(3);
  });

  it.each(tools)('sanitizes "$name" with zero malformed `required` arrays remaining', (tool) => {
    const schema = tool.inputSchema || tool.input_schema || {};
    const sanitised = sanitizeSchemaForGemini(schema);
    const hits = findInvalidRequired(sanitised);
    expect(hits, `malformed required still present in ${tool.name}: ${hits.join(' | ')}`).toEqual([]);
  });

  it('preserves at least some valid keywords (regression — over-strip would be just as bad)', () => {
    // search_catalog has a known `query` parameter with type=string.
    const searchCatalog = tools.find((t) => t.name === 'search_catalog');
    expect(searchCatalog).toBeDefined();
    const sanitised = sanitizeSchemaForGemini(searchCatalog.inputSchema);
    expect(sanitised.type).toBe('object');
    expect(sanitised.properties).toBeDefined();
    // Should still have nested properties with types
    const flatKeys = [];
    function collectTypes(node) {
      if (node && typeof node === 'object') {
        if (node.type) flatKeys.push(node.type);
        if (Array.isArray(node)) node.forEach(collectTypes);
        else Object.values(node).forEach(collectTypes);
      }
    }
    collectTypes(sanitised);
    expect(flatKeys.length).toBeGreaterThan(2);
  });
});
