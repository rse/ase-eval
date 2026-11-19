/*  "utilities": money formatting, mail sending, HTML rendering, HTTP
    helpers, feature flags, CSV export, and the pricing rules  */
const money       = (n) => Math.round(n * 100) / 100
const sendMail    = (to, subject, body) => { console.log(`mail to ${to}: ${subject} (${body.length} bytes)`) }
const renderHtml  = (order) => `<h1>Order ${order.id}</h1><p>Total: ${order.total}</p>`
const httpJson    = (res, obj) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(obj)) }
const flags       = { newCheckout: true, discounts: false }
const toCsv       = (rows) => rows.map((r) => Object.values(r).join(",")).join("\n")
const priceFor    = (item, customer) => customer.vip ? item.price * 0.9 : item.price
const vatRate     = (country) => ({ DE: 0.19, AT: 0.20, CH: 0.081 })[country] ?? 0.2

module.exports = { money, sendMail, renderHtml, httpJson, flags, toCsv, priceFor, vatRate }
