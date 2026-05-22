/**
 * Admin GraphQL wrapper.
 *
 * The chat widget runs on the storefront, not inside the embedded admin,
 * so we cannot use `authenticate.admin(request)` here. Instead we look up
 * the shop's stored Session row (created when the merchant installed the
 * app) and use its access token to authenticate Admin API calls directly.
 *
 * Calling code is responsible for ensuring the customer is authenticated
 * (via the Customer Account API token) and that the order/customer being
 * acted upon belongs to that customer — never trust the shopper to pass
 * arbitrary order IDs.
 */
import { getShopSession } from "../db.server";
import { apiVersion as defaultApiVersion } from "../shopify.server";

const API_VERSION = defaultApiVersion || "2025-10";

/**
 * Run an Admin GraphQL query/mutation against the given shop.
 * @param {string} shop - "acme.myshopify.com"
 * @param {string} query - GraphQL document
 * @param {Object} [variables]
 * @returns {Promise<Object>} The parsed `data` field (throws on userErrors/networkErrors)
 */
export async function adminGraphQL(shop, query, variables = {}) {
  if (!shop) throw new Error("adminGraphQL: missing shop");
  const session = await getShopSession(shop);
  if (!session?.accessToken) {
    throw new Error(`adminGraphQL: no installed-app session found for shop ${shop}`);
  }

  const endpoint = `https://${shop}/admin/api/${API_VERSION}/graphql.json`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": session.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Admin API HTTP ${res.status}: ${text}`);
  }

  const body = await res.json();
  if (body.errors && body.errors.length) {
    throw new Error(`Admin API GraphQL errors: ${JSON.stringify(body.errors)}`);
  }
  return body.data;
}
