/**
 * Authentication service for handling OAuth and PKCE flows
 */

/**
 * Derive the OAuth `redirect_uri` from the current runtime environment.
 *
 * Priority:
 *   1. SHOPIFY_APP_URL  — set by `shopify app dev` to the current tunnel host
 *                          and pushed to Partner Dashboard via
 *                          `automatically_update_urls_on_dev`. Following this
 *                          value means tunnel rotation is zero-touch.
 *   2. REDIRECT_URL     — legacy / production override (full callback URL).
 *
 * The path component is always `/auth/callback` because that's where
 * `app/routes/auth.callback.jsx` mounts.
 *
 * @returns {string|null}
 */
export function buildRedirectUri() {
  const appUrl = process.env.SHOPIFY_APP_URL;
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, "")}/auth/callback`;
  }
  if (process.env.REDIRECT_URL) {
    return process.env.REDIRECT_URL;
  }
  return null;
}

/**
 * Generate authorization URL for the customer
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<Object>} - Object containing the auth URL and conversation ID
 */
export async function generateAuthUrl(conversationId, shopId) {
  const { storeCodeVerifier } = await import('./db.server');

  // Generate authorization URL for the customer
  const clientId = process.env.SHOPIFY_API_KEY;
  //
  // Scope strategy (current production-safe choice):
  //   customer-account-mcp-api:full — Customer Account MCP server endpoint
  //                               (/customer/api/mcp). This is the scope Shopify
  //                               authorizes by default for embedded apps with
  //                               customer accounts auth.
  //
  // We tried adding `customer-account-api:full` for direct Customer Account
  // GraphQL access, but Shopify returned
  //   "The requested scope is invalid, unknown, or malformed."
  // because that scope requires Level 2 Protected Customer Data approval on
  // the Partner Dashboard — a manual review step this dev app hasn't passed.
  //
  // Implication: any customer-side tool that calls the direct GraphQL endpoint
  // (`/account/customer/api/<ver>/graphql`) will fail with "Invalid scope".
  // Use the MCP server's `tools/call` endpoint instead.
  const scope = "customer-account-mcp-api:full";
  const responseType = "code";

  // Derive redirect_uri from SHOPIFY_APP_URL (set automatically by `shopify app dev`
  // to the current tunnel host and pushed to Partner Dashboard via
  // automatically_update_urls_on_dev). Falling back to REDIRECT_URL keeps the
  // production deploy path working too.
  //
  // Why derived: Cloudflare Quick Tunnels rotate their hostname every dev
  // restart. Hardcoding the URL in .env meant every rotation broke OAuth until
  // someone manually re-synced four files. Reading from SHOPIFY_APP_URL means
  // tunnel rotations are zero-touch.
  const redirectUri = buildRedirectUri();
  if (!redirectUri) {
    throw new Error("Cannot build OAuth redirect_uri: neither SHOPIFY_APP_URL nor REDIRECT_URL is set.");
  }

  // Include the conversation ID and shop ID in the state parameter for tracking
  const state = `${conversationId}-${shopId}`;

  // Generate code verifier and challenge
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);

  console.log(`[auth-server] generateAuthUrl: state=${state}, verifier=${verifier.slice(0, 10)}…, challenge=${challenge.slice(0, 10)}…`);

  // Store the code verifier in the database. storeCodeVerifier UPSERTS by
  // state, so re-running generateAuthUrl for the same conversation replaces
  // the previous verifier — keeping DB and most-recent OAuth URL in sync.
  try {
    await storeCodeVerifier(state, verifier);
    console.log(`[auth-server] ✓ stored verifier for state=${state}`);
  } catch (error) {
    console.error('[auth-server] ✗ Failed to store code verifier:', error);
  }

  // Set code_challenge and code_challenge_method parameters
  const codeChallengeMethod = "S256";
  const baseAuthUrl = await getBaseAuthUrl(conversationId);

  if (!baseAuthUrl) {
    throw new Error('Base auth URL not found');
  }


  // Construct the authorization URL with hardcoded shop ID
  const authUrl = `${baseAuthUrl}?client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=${responseType}&state=${state}&code_challenge=${challenge}&code_challenge_method=${codeChallengeMethod}`;

  return {
    url: authUrl,
    conversation_id: conversationId
  };
}

/**
 * Get the base auth URL from the customer MCP API URL
 * @param {string} conversationId - The conversation ID to track the auth flow
 * @returns {Promise<string|null>} - The base auth URL or null if not found
 */
async function getBaseAuthUrl(conversationId) {
  const { getCustomerAccountUrls } = await import('./db.server');
  const { authorizationUrl } = await getCustomerAccountUrls(conversationId);

  return authorizationUrl;
}

/**
 * Generate a code verifier for PKCE
 * @returns {string} - The generated code verifier
 */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const randomString = convertBufferToString(array);
  return base64UrlEncode(randomString);
}

/**
 * Generate a code challenge from a verifier
 * @param {string} verifier - The code verifier
 * @returns {Promise<string>} - The generated code challenge
 */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digestOp = await crypto.subtle.digest('SHA-256', data);
  const hash = convertBufferToString(digestOp);
  return base64UrlEncode(hash);
}

/**
 * Convert a buffer to a string
 * @param {ArrayBuffer} buffer - The buffer to convert
 * @returns {string} - The converted string
 */
function convertBufferToString(buffer) {
  const uintArray = new Uint8Array(buffer);
  const numberArray = Array.from(uintArray);
  return String.fromCharCode.apply(null, numberArray);
}

/**
 * Encode a string in base64url format
 * @param {string} str - The string to encode
 * @returns {string} - The encoded string
 */
function base64UrlEncode(str) {
  // Convert string to base64
  let base64 = btoa(str);

  // Make base64 URL-safe by replacing characters
  base64 = base64.replace(/\+/g, "-")
                 .replace(/\//g, "_")
                 .replace(/=+$/, ""); // Remove any trailing '=' padding

  return base64;
}
