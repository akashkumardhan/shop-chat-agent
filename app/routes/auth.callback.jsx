import { getCodeVerifier, storeCustomerToken, getCustomerAccountUrls } from "../db.server";
import { buildRedirectUri } from "../auth.server";

/**
 * Handle OAuth callback from Shopify Customer API
 */
export async function loader({ request }) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  console.log(`[auth-callback] hit: code=${code ? `${code.slice(0, 8)}…` : 'NONE'}, state=${state}, error=${errorParam || 'none'}`);

  // Shopify redirects here with ?error=... when something is wrong (e.g. invalid_redirect_uri).
  // Surface it loudly so the developer can see what happened.
  if (errorParam) {
    console.error(`[auth-callback] Shopify returned an error: ${errorParam} — ${errorDescription || 'no description'}`);
    return new Response(
      `<!DOCTYPE html><html><body><h2>Authorization failed</h2><p><strong>${errorParam}</strong>: ${errorDescription || 'no description'}</p><p>Check the app server logs for details.</p></body></html>`,
      { status: 400, headers: { "Content-Type": "text/html" } }
    );
  }

  if (!state) {
    console.error("[auth-callback] state parameter is missing");
    return new Response(JSON.stringify({ error: "state parameter is missing" }), { status: 400 });
  }

  const [conversationId, shopId] = state.split("-");
  console.log(`[auth-callback] parsed state → conversationId=${conversationId}, shopId=${shopId}`);

  if (!code) {
    console.error("[auth-callback] code parameter is missing");
    return new Response(JSON.stringify({ error: "Authorization code is missing" }), { status: 400 });
  }

  try {
    // Exchange code for access token
    console.log("[auth-callback] exchanging code for token...");
    const tokenResponse = await exchangeCodeForToken(code, state);
    console.log(`[auth-callback] token exchange OK: expires_in=${tokenResponse.expires_in}s, scope=${tokenResponse.scope || 'n/a'}`);

    // Store token in database
    try {
      // Calculate expiration date based on expires_in (seconds)
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenResponse.expires_in);

      // Store in database with conversation ID
      await storeCustomerToken(
        conversationId,
        tokenResponse.access_token,
        expiresAt
      );

      console.log(`[auth-callback] ✓ Stored CustomerToken for conversation ${conversationId}, expires ${expiresAt.toISOString()}`);
    } catch (error) {
      console.error('[auth-callback] ✗ Failed to store token in database:', error);
      // Continue anyway to not disrupt user flow
    }

    // Instead of redirecting, return HTML that auto-closes the tab
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Authentication Successful</title>
        <script>
          window.onload = function() {
            // Show success message briefly before closing
            document.getElementById('message').style.display = 'block';
            // Close the tab after a short delay
            setTimeout(function() {
              window.close();
              // In case window.close() doesn't work (common in some browsers)
              document.getElementById('fallback').style.display = 'block';
            }, 1500);
          }
        </script>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding-top: 100px; }
          #message { display: none; }
          #fallback { display: none; margin-top: 20px; }
          .success { color: green; font-size: 18px; }
        </style>
      </head>
      <body>
        <div id="message">
          <h2>Authentication Successful!</h2>
          <p class="success">You've been authenticated successfully</p>
          <p>This window will close automatically.</p>
        </div>
        <div id="fallback">
          <p>If this window didn't close automatically, you can close it and return to your conversation.</p>
        </div>
      </body>
      </html>
    `, {
      headers: {
        "Content-Type": "text/html"
      }
    });
  } catch (error) {
    console.error("[auth-callback] ✗ Token exchange or storage threw:", error);
    console.log("[auth-callback] shopId from state was:", shopId);
    return new Response(
      `<!DOCTYPE html><html><body><h2>Authorization failed</h2><p>Token exchange error. Check app server logs for [auth-callback] entries.</p><pre>${String(error.message || error)}</pre></body></html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    );
  }
}

/**
 * Exchange authorization code for access token
 * @param {string} code - The authorization code
 * @returns {Promise<Object>} - The token response
 */
async function exchangeCodeForToken(code, state) {
  const clientId = process.env.SHOPIFY_API_KEY;
  const [conversationId, shopId] = state.split("-");
  if (!clientId || !shopId) {
    throw new Error("SHOPIFY_CLIENT_ID and SHOPIFY_SHOP_ID environment variables are required");
  }

  // Must match the redirect_uri sent during the authorize step. We derive it
  // the same way (buildRedirectUri preferring SHOPIFY_APP_URL) so both ends
  // automatically follow tunnel rotation.
  const redirectUri = buildRedirectUri();
  if (!redirectUri) {
    throw new Error("Cannot build redirect_uri for token exchange: SHOPIFY_APP_URL/REDIRECT_URL not set.");
  }

  // Correct token URL format
  const tokenUrl = await getTokenUrl(conversationId);

  if (!tokenUrl) {
    throw new Error("Token URL not found");
  }

  // Get the code verifier that corresponds to this authorization request from database
  let codeVerifier = "";
  try {
    const verifierRecord = await getCodeVerifier(state);
    if (verifierRecord) {
      codeVerifier = verifierRecord.verifier;
      console.log(`[auth-callback] retrieved verifier for state=${state}, verifier=${codeVerifier.slice(0, 10)}…`);
    } else {
      console.warn(`[auth-callback] ⚠ no verifier found in DB for state=${state} — token exchange will likely fail`);
    }
  } catch (error) {
    console.error("[auth-callback] error retrieving code verifier:", error);
  }

  const requestBody = {
    grant_type: "authorization_code",
    client_id: clientId,
    code: code,
    redirect_uri: redirectUri
  };

  // Add code_verifier if we have it
  if (codeVerifier) {
    requestBody.code_verifier = codeVerifier;
  }

  // Format the request as x-www-form-urlencoded instead of JSON
  const formData = new URLSearchParams();
  for (const [key, value] of Object.entries(requestBody)) {
    formData.append(key, value);
  }

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: formData
  });

  if (!response.ok) {
    console.log("Request id", response.headers.get("x-request-id"));
    console.log("conversation_id", conversationId);
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Get the token URL from the customer account URL
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<string|null>} - The token URL or null if not found
 */
async function getTokenUrl(conversationId) {
  const { tokenUrl } = await getCustomerAccountUrls(conversationId);
  return tokenUrl;
}
