/*  download of note attachments  */
const fs     = require("fs")
const path   = require("path")
const config = require("./config")

function attachmentStream (req, res) {
    const file = path.join(config.uploadDir, req.query.name)
    if (!fs.existsSync(file)) {
        res.statusCode = 404
        return res.end("not found")
    }
    res.setHeader("Content-Type", "application/octet-stream")
    fs.createReadStream(file).pipe(res)
}

module.exports = { attachmentStream }
