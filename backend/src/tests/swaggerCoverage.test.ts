/**
 * swaggerCoverage.test.ts
 *
 * Route coverage audit: verifies that the OpenAPI spec documents every
 * route that is actually registered in the Express app, and that the spec
 * does not contain paths that don't exist.
 *
 * This test is intentionally kept simple and deterministic — it uses the
 * known route list rather than Express introspection (which is unreliable
 * across middleware layers).  Any time a new route is added to the backend,
 * add it to EXPECTED_ROUTES below.
 */

import { describe, expect, it } from 'vitest';
import { buildOpenApiSpec } from '../docs/openapi.js';

/**
 * The canonical list of every route registered by the GhostPay backend.
 * Source: server.ts + all Router files (audited manually).
 *
 * Format: "METHOD /path" — use OpenAPI path template syntax for params.
 */
const EXPECTED_ROUTES: string[] = [
  // Health
  'GET /health',

  // Algorand
  'GET /api/algorand/network',
  'GET /api/algorand/signer',
  'GET /api/algorand/balance/{address}',
  'GET /api/algorand/assets/{address}',
  'POST /api/algorand/send',

  // Identity
  'POST /api/identity/request-verification',
  'POST /api/identity/send-sms-otp',
  'POST /api/identity/verify-mobile',
  'GET /api/identity/mobile/{mobileNumber}/wallets',
  'GET /api/identity/wallet/{walletAddress}',

  // Accounts
  'POST /api/accounts',
  'GET /api/accounts/phone/{phone}',
  'GET /api/accounts/wallet/{walletId}',
];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert Express path params (:foo) to OpenAPI style ({foo}) */
function expressToOpenApi(path: string): string {
  return path.replace(/:([^/]+)/g, '{$1}');
}

/** Collect all "METHOD /path" entries from an OpenAPI document */
function collectSpecRoutes(spec: ReturnType<typeof buildOpenApiSpec>): string[] {
  const routes: string[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!pathItem) continue;
    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const) {
      if (pathItem[method]) {
        routes.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return routes.sort();
}

// ─────────────────────────────────────────────────────────────────────────────

describe('OpenAPI spec coverage audit', () => {
  const spec = buildOpenApiSpec();
  const specRoutes = collectSpecRoutes(spec);
  const expectedSorted = [...EXPECTED_ROUTES].sort();

  it('spec documents every expected backend route', () => {
    const missing = expectedSorted.filter(r => !specRoutes.includes(r));
    expect(
      missing,
      `These routes are registered in Express but MISSING from the OpenAPI spec:\n${missing.join('\n')}`
    ).toHaveLength(0);
  });

  it('spec does not document routes that do not exist in the backend', () => {
    const extra = specRoutes.filter(r => !expectedSorted.includes(r));
    expect(
      extra,
      `These routes appear in the OpenAPI spec but are NOT registered in Express:\n${extra.join('\n')}`
    ).toHaveLength(0);
  });

  it('spec has the correct total route count', () => {
    expect(specRoutes).toHaveLength(EXPECTED_ROUTES.length);
  });

  it('spec version is 3.0.x', () => {
    expect(spec.openapi).toMatch(/^3\.0\./);
  });

  it('spec info title is GhostPay API', () => {
    expect(spec.info.title).toBe('GhostPay API');
  });

  it('spec defines all required tags', () => {
    const tagNames = (spec.tags ?? []).map(t => t.name);
    expect(tagNames).toContain('Health');
    expect(tagNames).toContain('Algorand');
    expect(tagNames).toContain('Identity');
    expect(tagNames).toContain('Accounts');
  });

  it('spec defines BearerApiKey security scheme', () => {
    expect(spec.components?.securitySchemes?.BearerApiKey).toBeDefined();
  });

  it('spec defines XApiKey security scheme', () => {
    expect(spec.components?.securitySchemes?.XApiKey).toBeDefined();
  });

  it('account routes require security declaration', () => {
    const accountPaths = ['/api/accounts', '/api/accounts/phone/{phone}', '/api/accounts/wallet/{walletId}'];
    for (const p of accountPaths) {
      const pathItem = spec.paths[p];
      expect(pathItem, `Path ${p} missing from spec`).toBeDefined();
      const op = (pathItem as Record<string, { security?: unknown }>)['post']
              ?? (pathItem as Record<string, { security?: unknown }>)['get'];
      expect(op?.security, `${p} should declare security`).toBeDefined();
    }
  });

  it('spec never exposes private key field names in schema property names', () => {
    const specJson = JSON.stringify(spec);
    const forbidden = ['privateKey', 'mnemonic', 'seedPhrase', 'secretKey', 'password'];
    for (const field of forbidden) {
      // Check property names in schemas — not descriptions (which may mention them
      // in a "never returns X" context)
      const inProperties = specJson.includes(`"properties":{"${field}"`);
      expect(inProperties, `Schema must not define a property named '${field}'`).toBe(false);
    }
  });

  it('all operationIds are unique', () => {
    const ids: string[] = [];
    for (const pathItem of Object.values(spec.paths ?? {})) {
      if (!pathItem) continue;
      for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
        const op = (pathItem as Record<string, { operationId?: string }>)[method];
        if (op?.operationId) ids.push(op.operationId);
      }
    }
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all $ref values point to existing schema components', () => {
    const specJson = JSON.stringify(spec);
    const refs = [...specJson.matchAll(/"\\$ref"\s*:\s*"#\/components\/schemas\/([^"]+)"/g)]
      .map(m => m[1]);

    const definedSchemas = Object.keys(spec.components?.schemas ?? {});
    for (const ref of refs) {
      expect(
        definedSchemas,
        `$ref '#/components/schemas/${ref}' points to an undefined schema`
      ).toContain(ref);
    }
  });
});
