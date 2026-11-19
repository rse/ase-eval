/*  stand-in for the real database client  */
module.exports = {
    async query (text, params = []) {
        return { rows: [], rowCount: 0, text, params }
    }
}
