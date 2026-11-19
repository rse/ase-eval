/*  naive CSV import (to be replaced)  */
import fs from "node:fs"
export function importCsv (file) {
    return fs.readFileSync(file, "utf8").split("\n").map((line) => line.split(","))
}
