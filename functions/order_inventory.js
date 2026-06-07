const VALID_ORDER_STATUSES = new Set(["pending", "paid", "shipped", "delivered"]);
const FULFILLMENT_STATUSES = new Set(["shipped", "delivered"]);

function hasFulfillmentInventory(orderData = {}) {
  return orderData.inventory_deducted === true || FULFILLMENT_STATUSES.has(orderData.status);
}

function getInventoryTransition(orderData = {}, nextStatus) {
  if (!VALID_ORDER_STATUSES.has(nextStatus)) {
    throw new Error("Invalid order status");
  }

  const shouldBeDeducted = FULFILLMENT_STATUSES.has(nextStatus);
  const wasDeducted = hasFulfillmentInventory(orderData);

  if (shouldBeDeducted && !wasDeducted) {
    return { action: "deduct", inventory_deducted: true };
  }

  if (!shouldBeDeducted && wasDeducted) {
    return { action: "restore", inventory_deducted: false };
  }

  return {
    action: "none",
    inventory_deducted: shouldBeDeducted,
  };
}

module.exports = {
  VALID_ORDER_STATUSES,
  FULFILLMENT_STATUSES,
  getInventoryTransition,
  hasFulfillmentInventory,
};
