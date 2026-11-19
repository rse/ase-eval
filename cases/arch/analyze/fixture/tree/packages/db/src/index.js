/*  persistence of orders  */
const { isCancellable } = require("@orders/core")

const table = new Map()

function saveOrder (order) {
    if (order.status === "cancelled" && !isCancellable({ status: "placed" }))
        throw new Error("invalid state transition")
    table.set(order.id, JSON.parse(JSON.stringify(order)))
}

function loadOrder (id) {
    return table.get(id)
}

module.exports = { saveOrder, loadOrder }
