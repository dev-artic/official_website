const assert = require("assert");
const { getInventoryTransition } = require("../functions/order_inventory");

const cases = [
  {
    name: "pending order stays reserved-free when marked paid",
    order: { status: "pending", inventory_deducted: false },
    nextStatus: "paid",
    expected: { action: "none", inventory_deducted: false },
  },
  {
    name: "paid order deducts once when shipped",
    order: { status: "paid", inventory_deducted: false },
    nextStatus: "shipped",
    expected: { action: "deduct", inventory_deducted: true },
  },
  {
    name: "shipped order does not deduct again when delivered",
    order: { status: "shipped", inventory_deducted: true },
    nextStatus: "delivered",
    expected: { action: "none", inventory_deducted: true },
  },
  {
    name: "fulfilled order restores inventory when returned to paid",
    order: { status: "delivered", inventory_deducted: true },
    nextStatus: "paid",
    expected: { action: "restore", inventory_deducted: false },
  },
  {
    name: "legacy fulfilled order without flag still restores inventory",
    order: { status: "delivered", inventory_deducted: false },
    nextStatus: "paid",
    expected: { action: "restore", inventory_deducted: false },
  },
  {
    name: "legacy shipped order without flag is normalized, not double-deducted",
    order: { status: "shipped", inventory_deducted: false },
    nextStatus: "delivered",
    expected: { action: "none", inventory_deducted: true },
  },
];

cases.forEach(({ name, order, nextStatus, expected }) => {
  assert.deepStrictEqual(getInventoryTransition(order, nextStatus), expected, name);
});

assert.throws(
  () => getInventoryTransition({ status: "pending" }, "cancelled"),
  /Invalid order status/,
  "invalid status should be rejected"
);

console.log(`order inventory transition tests passed (${cases.length + 1})`);
