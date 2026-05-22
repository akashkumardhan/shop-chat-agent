/**
 * Local tools registry. These tools run server-side in this app, in addition
 * to the tools auto-discovered from Storefront MCP and Customer Account MCP.
 *
 * Usage:
 *   import { localToolDefinitions, runLocalTool, isLocalTool } from "./tools";
 *   if (isLocalTool(name)) {
 *     const result = await runLocalTool(name, ctx, args);
 *   }
 */
import { orderOpsToolDefinitions, listMyOrders, cancelMyOrder } from "./orderOps.server";
import { returnsToolDefinitions, calculateReturn, requestReturn } from "./returns.server";
import {
  profileToolDefinitions,
  getMyProfile,
  updateMyProfile,
  addMyAddress,
  updateMyAddress,
  deleteMyAddress,
} from "./profile.server";

/**
 * Map of tool name → execution function.
 * Each executor receives `(ctx, args)` where ctx = { conversationId, shop }.
 * The function returns either:
 *   - { ...payload }           — success; serialised back to Claude
 *   - { error: "..." }         — handled error; surfaced to Claude
 *   - { _authRequired: true }  — caller should fire the auth_required flow
 */
const EXECUTORS = {
  list_my_orders: listMyOrders,
  cancel_my_order: cancelMyOrder,
  calculate_return: calculateReturn,
  request_return: requestReturn,
  get_my_profile: getMyProfile,
  update_my_profile: updateMyProfile,
  add_my_address: addMyAddress,
  update_my_address: updateMyAddress,
  delete_my_address: deleteMyAddress,
};

export const localToolDefinitions = [
  ...orderOpsToolDefinitions,
  ...returnsToolDefinitions,
  ...profileToolDefinitions,
];

export function isLocalTool(name) {
  return Object.prototype.hasOwnProperty.call(EXECUTORS, name);
}

/**
 * Execute a local tool. Always returns a string-content shape compatible with
 * how Claude's tool-result is formatted in `tool.server.js`.
 *
 * @param {string} name
 * @param {{ conversationId: string, shop: string }} ctx
 * @param {Object} args
 * @returns {Promise<{ content?: Array, error?: Object }>}
 */
export async function runLocalTool(name, ctx, args) {
  const fn = EXECUTORS[name];
  if (!fn) {
    return { error: { type: "not_found", data: `Local tool ${name} not registered.` } };
  }

  let result;
  try {
    result = await fn(ctx, args || {});
  } catch (e) {
    console.error(`[local-tool] ${name} THREW:`, e);
    return { error: { type: "internal_error", data: e.message || String(e) } };
  }

  if (result && result._authRequired) {
    console.log(`[local-tool] ${name} → auth_required`);
    return {
      error: {
        type: "auth_required",
        data: "Please sign in to your customer account to continue.",
      },
    };
  }

  // Differentiate handled-error from success so we can see failures in logs.
  if (result && result.error) {
    console.warn(`[local-tool] ${name} → handled error: ${result.error}`);
  } else {
    const summary = summariseResult(result);
    console.log(`[local-tool] ${name} → ok: ${summary}`);
  }

  // Pass through as text content so the existing tool.server.js handler treats it like an MCP response.
  return {
    content: [
      { type: "text", text: JSON.stringify(result) },
    ],
  };
}

/**
 * Build a one-line summary of a tool result for the log. Keeps things readable
 * without dumping full payloads (which can be big and may contain PII).
 */
function summariseResult(result) {
  if (!result) return "null";
  if (Array.isArray(result.orders)) return `${result.orders.length} order(s), hasMore=${!!result.hasMore}`;
  if (result.cancelled) return `cancelled ${result.orderName || result.orderId}`;
  if (result.estimatedRefund) return `refund estimate ${result.estimatedRefund}`;
  if (result.requested) return `return requested ${result.returnId}`;
  if (result.id && result.email !== undefined) return `profile ${result.email || result.displayName || result.id}`;
  if (result.created || result.updated || result.deleted) return Object.keys(result).filter(k => ['created','updated','deleted'].includes(k))[0];
  return Object.keys(result).join(",");
}
