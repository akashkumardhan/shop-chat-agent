/**
 * customer-identity — extract the authenticated customer's GID from the
 * cached Customer-MCP OAuth token (JWT) and return it for use in Admin API
 * calls.
 *
 * Why this exists:
 *   Our app's OAuth client only gets the `customer-account-mcp-api:full`
 *   scope. That blocks us from calling the direct Customer Account GraphQL
 *   API (returns "Invalid scope"). Instead we identify the customer from
 *   the JWT's `sub` claim and run all operations server-side via Admin API
 *   filtered by that customer ID. This is the Path B hybrid architecture.
 *
 * Trust model:
 *   The JWT was minted by Shopify and stored by our own OAuth callback.
 *   We trust the `sub` claim because we obtained the token via OAuth on
 *   the merchant's own auth domain. For tightened production security,
 *   verify the JWT signature against Shopify's JWKS endpoint — out of
 *   scope for v1.
 */
import { getCustomerToken } from "../db.server";

/**
 * Decode the payload section of a JWT without verifying the signature.
 * @param {string} jwt
 * @returns {Object|null}
 */
function decodeJwtPayload(jwt) {
  if (!jwt || typeof jwt !== "string") return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  // base64url → base64
  const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(
    parts[1].length + ((4 - (parts[1].length % 4)) % 4),
    "="
  );
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    console.error("[customer-identity] failed to decode JWT payload:", e.message);
    return null;
  }
}

/**
 * Resolve the authenticated customer's GID for a conversation.
 *
 * @param {string} conversationId
 * @returns {Promise<{ customerGid?: string, customerNumericId?: string, _authRequired?: true }>}
 */
export async function requireCustomer(conversationId) {
  if (!conversationId) return { _authRequired: true };
  const token = await getCustomerToken(conversationId);
  if (!token?.accessToken) return { _authRequired: true };

  const payload = decodeJwtPayload(token.accessToken);
  if (!payload) {
    console.error("[customer-identity] JWT decode failed for conversation", conversationId);
    return { _authRequired: true };
  }

  // `sub` is a numeric Shopify customer ID (per the live token shape).
  // Construct the GID for Admin API consumption.
  const sub = payload.sub;
  if (!sub) {
    console.error("[customer-identity] JWT has no `sub` claim", { conversationId, keys: Object.keys(payload) });
    return { _authRequired: true };
  }

  const numericId = String(sub);
  return {
    customerGid: `gid://shopify/Customer/${numericId}`,
    customerNumericId: numericId,
  };
}
