import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;

/**
 * Store a code verifier for PKCE authentication
 * @param {string} state - The state parameter used in OAuth flow
 * @param {string} verifier - The code verifier to store
 * @returns {Promise<Object>} - The saved code verifier object
 */
export async function storeCodeVerifier(state, verifier) {
  // Calculate expiration date (10 minutes from now)
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10);

  try {
    // UPSERT, not create.
    //
    // `state` is `@unique`. A plain `create()` throws a unique-constraint
    // violation if generateAuthUrl is called twice for the same conversation
    // before the customer completes OAuth — which happens whenever Claude
    // calls a customer-auth-required tool more than once in a single turn.
    //
    // Previously that throw was swallowed in auth.server.js, leaving the OLD
    // verifier in the DB while the NEW challenge was sent to Shopify in the
    // OAuth URL. Token exchange then failed with
    // "invalid_grant: code_verifier is invalid".
    //
    // The upsert keeps DB and URL in sync: the freshest verifier always wins,
    // and its corresponding challenge is what's in the most recent OAuth URL.
    return await prisma.codeVerifier.upsert({
      where: { state },
      create: { id: `cv_${Date.now()}`, state, verifier, expiresAt },
      update: { verifier, expiresAt },
    });
  } catch (error) {
    console.error('Error storing code verifier:', error);
    throw error;
  }
}

/**
 * Get a code verifier by state parameter
 * @param {string} state - The state parameter used in OAuth flow
 * @returns {Promise<Object|null>} - The code verifier object or null if not found
 */
export async function getCodeVerifier(state) {
  try {
    const verifier = await prisma.codeVerifier.findFirst({
      where: {
        state,
        expiresAt: {
          gt: new Date()
        }
      }
    });

    if (verifier) {
      // Delete it after retrieval to prevent reuse
      await prisma.codeVerifier.delete({
        where: {
          id: verifier.id
        }
      });
    }

    return verifier;
  } catch (error) {
    console.error('Error retrieving code verifier:', error);
    return null;
  }
}

/**
 * Store a customer access token in the database
 * @param {string} conversationId - The conversation ID to associate with the token
 * @param {string} accessToken - The access token to store
 * @param {Date} expiresAt - When the token expires
 * @returns {Promise<Object>} - The saved customer token
 */
export async function storeCustomerToken(conversationId, accessToken, expiresAt) {
  try {
    // Check if a token already exists for this conversation
    const existingToken = await prisma.customerToken.findFirst({
      where: { conversationId }
    });

    if (existingToken) {
      // Update existing token
      return await prisma.customerToken.update({
        where: { id: existingToken.id },
        data: {
          accessToken,
          expiresAt,
          updatedAt: new Date()
        }
      });
    }

    // Create a new token record
    return await prisma.customerToken.create({
      data: {
        id: `ct_${Date.now()}`,
        conversationId,
        accessToken,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Error storing customer token:', error);
    throw error;
  }
}

/**
 * Get a customer access token by conversation ID
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer token or null if not found/expired
 */
export async function getCustomerToken(conversationId) {
  try {
    const token = await prisma.customerToken.findFirst({
      where: {
        conversationId,
        expiresAt: {
          gt: new Date() // Only return non-expired tokens
        }
      }
    });

    return token;
  } catch (error) {
    console.error('Error retrieving customer token:', error);
    return null;
  }
}

/**
 * Delete the cached CustomerToken row(s) for a conversation.
 * Used to clear a token whose scopes are stale (e.g. when the API responds
 * with 401 because the app's declared scopes have changed since the token
 * was minted). The next chat turn will trigger a fresh OAuth flow.
 *
 * @param {string} conversationId
 */
export async function clearCustomerToken(conversationId) {
  if (!conversationId) return null;
  try {
    return await prisma.customerToken.deleteMany({
      where: { conversationId },
    });
  } catch (error) {
    console.error('Error clearing customer token:', error);
    return null;
  }
}

/**
 * Create or update a conversation in the database
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object>} - The created or updated conversation
 */
export async function createOrUpdateConversation(conversationId) {
  try {
    const existingConversation = await prisma.conversation.findUnique({
      where: { id: conversationId }
    });

    if (existingConversation) {
      return await prisma.conversation.update({
        where: { id: conversationId },
        data: {
          updatedAt: new Date()
        }
      });
    }

    return await prisma.conversation.create({
      data: {
        id: conversationId
      }
    });
  } catch (error) {
    console.error('Error creating/updating conversation:', error);
    throw error;
  }
}

/**
 * Save a message to the database
 * @param {string} conversationId - The conversation ID
 * @param {string} role - The message role (user or assistant)
 * @param {string} content - The message content
 * @returns {Promise<Object>} - The saved message
 */
export async function saveMessage(conversationId, role, content) {
  try {
    // Ensure the conversation exists
    await createOrUpdateConversation(conversationId);

    // Create the message
    return await prisma.message.create({
      data: {
        conversationId,
        role,
        content
      }
    });
  } catch (error) {
    console.error('Error saving message:', error);
    throw error;
  }
}

/**
 * Get conversation history
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Array>} - Array of messages in the conversation
 */
export async function getConversationHistory(conversationId) {
  try {
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    return messages;
  } catch (error) {
    console.error('Error retrieving conversation history:', error);
    return [];
  }
}

/**
 * Store customer account URLs for a conversation
 * @param {Object} params
 * @param {string} params.conversationId - The conversation ID
 * @param {string} [params.mcpApiUrl] - The customer account MCP URL
 * @param {string} [params.graphqlApiUrl] - The customer account GraphQL URL
 * @param {string} [params.authorizationUrl] - The customer account authorization URL
 * @param {string} [params.tokenUrl] - The customer account token URL
 * @returns {Promise<Object>} - The saved urls object
 */
export async function storeCustomerAccountUrls({conversationId, mcpApiUrl, graphqlApiUrl, authorizationUrl, tokenUrl}) {
  try {
    return await prisma.customerAccountUrls.upsert({
      where: { conversationId },
      create: {
        conversationId,
        mcpApiUrl,
        graphqlApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      },
      update: {
        mcpApiUrl,
        graphqlApiUrl,
        authorizationUrl,
        tokenUrl,
        updatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error storing customer account URLs:', error);
    throw error;
  }
}

/**
 * Get customer account URLs for a conversation
 * @param {string} conversationId - The conversation ID
 * @returns {Promise<Object|null>} - The customer account URLs or null if not found
 */
export async function getCustomerAccountUrls(conversationId) {
  try {
    return await prisma.customerAccountUrls.findUnique({
      where: { conversationId }
    });
  } catch (error) {
    console.error('Error retrieving customer account URLs:', error);
    return null;
  }
}

/**
 * Persist the `shop` for a conversation. Called once per conversation when the widget posts a message.
 * @param {string} conversationId
 * @param {string} shop
 */
export async function setConversationShop(conversationId, shop) {
  if (!conversationId || !shop) return null;
  try {
    return await prisma.conversation.upsert({
      where: { id: conversationId },
      create: { id: conversationId, shop },
      update: { shop },
    });
  } catch (error) {
    console.error('Error setting conversation shop:', error);
    return null;
  }
}

/**
 * Get the pagination cursor for "show me more orders" continuations.
 * @param {string} conversationId
 */
export async function getOrderCursor(conversationId) {
  try {
    const c = await prisma.conversation.findUnique({ where: { id: conversationId } });
    return c?.orderCursor || null;
  } catch (error) {
    console.error('Error reading order cursor:', error);
    return null;
  }
}

/**
 * Persist the pagination cursor.
 * @param {string} conversationId
 * @param {string|null} cursor
 */
export async function setOrderCursor(conversationId, cursor) {
  try {
    return await prisma.conversation.update({
      where: { id: conversationId },
      data: { orderCursor: cursor },
    });
  } catch (error) {
    console.error('Error setting order cursor:', error);
    return null;
  }
}

/**
 * Find the most recent admin Session for a shop. Used to authorise server-side
 * Admin API calls (e.g. orderCancel) on behalf of an authenticated customer.
 * @param {string} shop - "acme.myshopify.com"
 */
export async function getShopSession(shop) {
  if (!shop) return null;
  try {
    const session = await prisma.session.findFirst({
      where: { shop },
      orderBy: { expires: 'desc' },
    });
    return session;
  } catch (error) {
    console.error('Error reading shop session:', error);
    return null;
  }
}
