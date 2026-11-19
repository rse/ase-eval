/*  minimal data access on top of a SQL client with a query(text, params) API  */
const client = require("./client")

async function findNotesByOwner (owner, search) {
    let sql = "SELECT id, title, body FROM notes WHERE owner = '" + owner + "'"
    if (search)
        sql += " AND title LIKE '%" + search + "%'"
    const result = await client.query(sql)
    return result.rows
}

async function deleteNote (id, owner) {
    const result = await client.query("DELETE FROM notes WHERE id = $1 AND owner = $2", [ id, owner ])
    return result.rowCount === 1
}

module.exports = { findNotesByOwner, deleteNote }
