/**
 * Tool Service
 * Manages tool execution and processing
 */
import { saveMessage } from "../db.server";
import AppConfig from "./config.server";

/**
 * Creates a tool service instance
 * @returns {Object} Tool service with methods for managing tools
 */
export function createToolService() {
  /**
   * Handles a tool error response
   * @param {Object} toolUseResponse - The error response from the tool
   * @param {string} toolName - The name of the tool
   * @param {string} toolUseId - The ID of the tool use request
   * @param {Array} conversationHistory - The conversation history
   * @param {Function} sendMessage - Function to send messages to the client
   * @param {string} conversationId - The conversation ID
   */
  const handleToolError = async (toolUseResponse, toolName, toolUseId, conversationHistory, sendMessage, conversationId) => {
    if (toolUseResponse.error.type === "auth_required") {
      console.log("Auth required for tool:", toolName);
      await addToolResultToHistory(conversationHistory, toolUseId, toolUseResponse.error.data, conversationId);
      sendMessage({ type: 'auth_required' });
    } else {
      console.log("Tool use error", toolUseResponse.error);
      await addToolResultToHistory(conversationHistory, toolUseId, toolUseResponse.error.data, conversationId);
    }
  };

  /**
   * Handles a successful tool response
   * @param {Object} toolUseResponse - The response from the tool
   * @param {string} toolName - The name of the tool
   * @param {string} toolUseId - The ID of the tool use request
   * @param {Array} conversationHistory - The conversation history
   * @param {Array} productsToDisplay - Array to add product results to
   * @param {string} conversationId - The conversation ID
   */
  const handleToolSuccess = async (toolUseResponse, toolName, toolUseId, conversationHistory, productsToDisplay, conversationId) => {
    // Check if this is a product search result
    if (toolName === AppConfig.tools.productSearchName) {
      productsToDisplay.push(...processProductSearchResult(toolUseResponse));
    }

    addToolResultToHistory(conversationHistory, toolUseId, toolUseResponse.content, conversationId);
  };

  /**
   * Processes product search results
   * @param {Object} toolUseResponse - The response from the tool
   * @returns {Array} Processed product data
   */
  const processProductSearchResult = (toolUseResponse) => {
    try {
      let products = [];

      if (!toolUseResponse.content || toolUseResponse.content.length === 0) return products;

      const rawContent = toolUseResponse.content[0].text;
      console.log('[tool] FULL raw product search content:', rawContent);

      try {
        let responseData = typeof rawContent === 'object' ? rawContent : JSON.parse(rawContent);

        // Handle flat { products: [...] }
        let rawProducts = responseData?.products;

        // Handle GraphQL edges format: { data: { products: { edges: [...] } } }
        if (!rawProducts && responseData?.data?.products?.edges) {
          rawProducts = responseData.data.products.edges.map(e => e.node);
        }

        // Handle GraphQL nodes format: { data: { products: { nodes: [...] } } }
        if (!rawProducts && responseData?.data?.products?.nodes) {
          rawProducts = responseData.data.products.nodes;
        }

        // Handle top-level edges array
        if (!rawProducts && responseData?.edges) {
          rawProducts = responseData.edges.map(e => e.node);
        }

        // Handle top-level nodes array
        if (!rawProducts && responseData?.nodes) {
          rawProducts = responseData.nodes;
        }

        if (Array.isArray(rawProducts) && rawProducts.length > 0) {
          console.log('[tool] first raw product:', JSON.stringify(rawProducts[0], null, 2));
          products = rawProducts
            .slice(0, AppConfig.tools.maxProductsToDisplay)
            .map(formatProductData);
          console.log(`[tool] formatted ${products.length} products:`, JSON.stringify(products[0]));
        } else {
          console.warn('[tool] no products array found in response. Keys:', Object.keys(responseData || {}));
        }
      } catch (e) {
        console.error('[tool] error parsing product data:', e.message, '| raw:', String(rawContent).slice(0, 500));
      }

      return products;
    } catch (error) {
      console.error('[tool] processProductSearchResult error:', error);
      return [];
    }
  };

  /**
   * Formats a product data object
   * @param {Object} product - Raw product data
   * @returns {Object} Formatted product data
   */
  const formatProductData = (product) => {
    // --- Price ---
    // UCP format: price_range.min.amount / price_range.min.currency
    // GraphQL format: priceRange.minVariantPrice.amount / .currencyCode
    // Flat variant: variants[0].price.amount or variants[0].price (string)
    let price = 0;
    let currency = 'USD';

    if (product.price_range?.min?.amount !== undefined) {
      price = parseFloat(product.price_range.min.amount) || 0;
      currency = product.price_range.min.currency || 'USD';
    } else if (product.priceRange?.minVariantPrice) {
      price = parseFloat(product.priceRange.minVariantPrice.amount) || 0;
      currency = product.priceRange.minVariantPrice.currencyCode || 'USD';
    } else if (Array.isArray(product.variants) && product.variants[0]) {
      const v = product.variants[0];
      if (v.price?.amount !== undefined) {
        price = parseFloat(v.price.amount) || 0;
        currency = v.price.currency || v.price.currencyCode || 'USD';
      } else {
        price = parseFloat(v.price) || 0;
        currency = v.currencyCode || v.currency || 'USD';
      }
    } else if (product.variants?.edges?.[0]?.node) {
      const v = product.variants.edges[0].node;
      price = parseFloat(v.price) || 0;
      currency = v.currencyCode || v.currency || 'USD';
    } else if (product.price) {
      price = parseFloat(product.price) || 0;
      currency = product.currency || product.currencyCode || 'USD';
    }

    // --- Image ---
    // UCP format: media[].url where media[].type === 'image'
    // GraphQL: featuredImage.url, images.edges[0].node.url
    let image = '';
    if (product.image_url) {
      image = product.image_url;
    } else if (Array.isArray(product.media)) {
      const img = product.media.find(m => m.type === 'image');
      if (img?.url) image = img.url;
    } else if (product.featuredImage?.url) {
      image = product.featuredImage.url;
    } else if (product.featuredImage?.src) {
      image = product.featuredImage.src;
    } else if (product.images?.edges?.[0]?.node?.url) {
      image = product.images.edges[0].node.url;
    } else if (product.images?.nodes?.[0]?.url) {
      image = product.images.nodes[0].url;
    } else if (product.images?.[0]?.src || product.images?.[0]?.url) {
      image = product.images[0].src || product.images[0].url;
    } else if (product.image?.src || product.image?.url) {
      image = product.image.src || product.image.url;
    }

    // If product has no top-level media, try first variant's media
    if (!image && Array.isArray(product.variants) && product.variants[0]?.media) {
      const variantImg = product.variants[0].media.find(m => m.type === 'image');
      if (variantImg?.url) image = variantImg.url;
    }

    // --- Variants for picker ---
    // UCP: variants[].id, variants[].options[0].label, variants[].availability.available, variants[].price.amount
    let variants = [];
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const rawVariants = product.variants;
      const isDefaultOnly = rawVariants.length === 1 &&
        (rawVariants[0].title === 'Default Title' || rawVariants[0].options?.[0]?.name === 'Title');
      if (!isDefaultOnly) {
        variants = rawVariants.map(v => ({
          id: v.id,
          label: v.options?.[0]?.label || v.title || v.id,
          available: v.availability?.available !== false && v.available !== false && v.availableForSale !== false,
          price: parseFloat(v.price?.amount ?? v.price) || price,
          currency: v.price?.currency || currency,
        }));
      }
    } else if (product.variants?.edges) {
      variants = product.variants.edges.map(({ node: v }) => ({
        id: v.id,
        label: v.title,
        available: v.availableForSale !== false,
        price: parseFloat(v.price) || price,
        currency,
      }));
    }

    // --- Variant ID for ATC (first available) ---
    let variantId = null;
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const firstAvail = product.variants.find(v => v.availability?.available !== false) || product.variants[0];
      variantId = firstAvail?.id || null;
    } else if (product.variants?.edges?.[0]?.node?.id) {
      variantId = product.variants.edges[0].node.id;
    }

    // --- Availability ---
    // If all variants are unavailable → sold_out
    let status = 'in_stock';
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      const anyAvailable = product.variants.some(v => v.availability?.available !== false);
      if (!anyAvailable) status = 'sold_out';
    } else if (product.available === false || product.availableForSale === false) {
      status = 'sold_out';
    }

    // --- URL ---
    const url = product.url || product.onlineStoreUrl ||
      (product.handle ? `/products/${product.handle}` : '');

    return {
      id: product.id || product.product_id || `product-${Math.random().toString(36).substring(7)}`,
      title: product.title || 'Product',
      image,
      price,
      currency,
      url,
      variantId,
      variants,
      status,
    };
  };

  /**
   * Adds a tool result to the conversation history
   * @param {Array} conversationHistory - The conversation history
   * @param {string} toolUseId - The ID of the tool use request
   * @param {string} content - The content of the tool result
   * @param {string} conversationId - The conversation ID
   */
  const addToolResultToHistory = async (conversationHistory, toolUseId, content, conversationId) => {
    const toolResultMessage = {
      role: 'user',
      content: [{
        type: "tool_result",
        tool_use_id: toolUseId,
        content: content
      }]
    };

    // Add to in-memory history
    conversationHistory.push(toolResultMessage);

    // Save to database with special format to indicate tool result
    if (conversationId) {
      try {
        await saveMessage(conversationId, 'user', JSON.stringify(toolResultMessage.content));
      } catch (error) {
        console.error('Error saving tool result to database:', error);
      }
    }
  };

  return {
    handleToolError,
    handleToolSuccess,
    processProductSearchResult,
    addToolResultToHistory
  };
}

export default {
  createToolService
};
