/*  domain logic of orders  */
const { saveOrder, loadOrder } = require("@orders/db")
const { money, sendMail, renderHtml } = require("@orders/util")

function placeOrder (customer, items) {
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0)
    const order = { id: Date.now(), customer, items, total: money(total), status: "placed" }
    saveOrder(order)
    sendMail(customer.email, "Order placed", renderHtml(order))
    return order
}

function cancelOrder (id) {
    const order = loadOrder(id)
    order.status = "cancelled"
    saveOrder(order)
    return order
}

function isCancellable (order) {
    return order.status === "placed"
}

module.exports = { placeOrder, cancelOrder, isCancellable }
