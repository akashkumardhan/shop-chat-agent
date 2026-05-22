/**
 * Admin GraphQL wrapper.
 *
 * Uses the Shopify library's `unauthenticated.admin(shop)` rather than
 * sending the stored offline token directly. The library performs token
 * exchange under the hood, which is the flow Shopify now requires:
 *
 *   "Non-expiring access tokens are no longer accepted for the Admin API.
 *    Start using expiring offline tokens." — shopify.dev, Dec 2025
 *
 * Token exchange swaps a long-lived offline token (or the merchant's
 * Shopify-managed install record) for a short-lived expiring access
 * token + refresh token, rotating automatically. The library handles
 * the rotation; we just call admin.graphql().
 *
 * The chat widget calls the storefront, not the embedded admin, so we
 * use the `unauthenticated.admin(shop)` variant (which doesn't need a
 * session token from a request — it uses the installed-app session).
 *
 * Calling code is responsible for ensuring the customer is authenticated
 * (via the Customer Account API token) and that the order/customer being
 * acted upon belongs to that customer — never trust the shopper to pass
 * arbitrary order IDs.
 */
import { unauthenticated } from "../shopify.server";

/**
 * Run an Admin GraphQL query/mutation against the given shop.
 * @param {string} shop - "acme.myshopify.com"
 * @param {string} query - GraphQL document
 * @param {Object} [variables]
 * @returns {Promise<Object>} The parsed `data` field (throws on userErrors/networkErrors)
 */
export async function adminGraphQL(shop, query, variables = {}) {
  if (!shop) throw new Error("adminGraphQL: missing shop");

  let admin;
  try {
    // Library throws if the app isn't installed on this shop. The thrown
    // value is a Response-like object; convert to a readable error string.
    ({ admin } = await unauthenticated.admin(shop));
  } catch (e) {
    // If `e` is a Response, the library lost a session. Surface clearly.
    const detail = e?.message || e?.statusText || JSON.stringify(e);
    throw new Error(
      `adminGraphQL: no valid session for shop ${shop}. Reinstall the app on this store. (${detail})`
    );
  }

  const response = await admin.graphql(query, { variables });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Admin API HTTP ${response.status}: ${text}`);
  }

  const body = await response.json();
  if (body.errors && body.errors.length) {
    throw new Error(`Admin API GraphQL errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}
