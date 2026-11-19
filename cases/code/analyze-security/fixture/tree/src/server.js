/*  HTTP entry point of the notes service  */
const http  = require("http")
const url   = require("url")
const db    = require("./db")
const files = require("./files")
const config = require("./config")

const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true)
    req.query = parsed.query
    const owner = req.headers["x-user"]
    if (parsed.pathname === "/notes") {
        const notes = await db.findNotesByOwner(owner, req.query.q)
        res.setHeader("Content-Type", "application/json")
        return res.end(JSON.stringify(notes))
    }
    if (parsed.pathname === "/attachment")
        return files.attachmentStream(req, res)
    res.statusCode = 404
    res.end()
})

server.listen(config.port)
