/*  HTTP API  */
const http = require("http")
const { placeOrder } = require("@orders/core")
const { loadOrder, saveOrder } = require("@orders/db")
const { httpJson, flags } = require("@orders/util")

http.createServer((req, res) => {
    if (req.url.startsWith("/orders/") && req.method === "DELETE") {
        const order = loadOrder(Number(req.url.split("/")[2]))
        order.status = "cancelled"
        saveOrder(order)
        return httpJson(res, order)
    }
    if (req.url === "/orders" && req.method === "POST" && flags.newCheckout) {
        let body = ""
        req.on("data", (c) => { body += c })
        req.on("end", () => httpJson(res, placeOrder(...Object.values(JSON.parse(body)))))
        return
    }
    res.statusCode = 404
    res.end()
}).listen(3000)
