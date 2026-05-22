/**
 * Customer Account GraphQL wrapper.
 *
 * Uses the customer's OAuth access token (stored in `CustomerToken`) to call
 * the Customer Account API directly. The endpoint URL is discovered per shop
 * and cached in `CustomerAccountUrls.graphqlApiUrl`.
 *
 * Returns `{ data, requiresAuth }`. When `requiresAuth` is true, the caller
 * should surface the auth_required flow the same way `mcp-client.js` does
 * for the Customer MCP tools.
 */
import { getCustomerToken, getCustomerAccountUrls, clearCustomerToken } from "../db.server";

/**
 * Run a Customer Account GraphQL query/mutation for a conversation's authed customer.
 * @param {string} conversationId
 * @param {string} query
 * @param {Object} [variables]
 * @returns {Promise<{data?: Object, requiresAuth?: boolean, error?: string}>}
 */
export async function customerGraphQL(conversationId, query, variables = {}) {
  if (!conversationId) {
    return { error: "missing conversationId" };
  }

  const token = await getCustomerToken(conversationId);
  if (!token?.accessToken) {
    return { requiresAuth: true };
  }

  const urls = await getCustomerAccountUrls(conversationId);
  const endpoint = urls?.graphqlApiUrl;
  if (!endpoint) {
    return { error: "Customer Account GraphQL endpoint not discovered for this conversation" };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token.accessToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (res.status === 401) {
    // The cached token is stale — either revoked, expired between our
    // expiresAt check and now, or missing scopes we just added to the toml.
    // Clear it so the next chat turn re-runs the OAuth flow and mints a
    // fresh token that carries the current declared scopes.
    console.log(`[customer-graphql] 401 from Customer Account API — clearing stale token for conversation ${conversationId}`);
    await clearCustomerToken(conversationId);
    return { requiresAuth: true };
  }
  if (!res.ok) {
    const text = await res.text();
    return { error: `Customer Account API HTTP ${res.status}: ${text}` };
  }

  const body = await res.json();
  if (body.errors && body.errors.length) {
    return { error: `Customer Account API GraphQL errors: ${JSON.stringify(body.errors)}` };
  }
  return { data: body.data };
}
