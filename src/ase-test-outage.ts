/*
**  Agentic Software Engineering (ASE)
**  Copyright (c) 2025-2026 Dr. Ralf S. Engelschall <rse@engelschall.com>
**  Licensed under Apache 2.0 <https://spdx.org/licenses/Apache-2.0>
*/

import * as fs   from "node:fs"
import * as path from "node:path"

import chalk from "chalk"

/*  the configuration of the pauses and the outage state: the abort check of the
    runner (a pause ends early once the scheduling was aborted) and the outage
    file (shared by all runners of a launcher, else private to this runner)  */
const outageConfig = {
    aborted: (): boolean => false,
    file:    ""
}
export const outageConfigure = (file: string, aborted: () => boolean): void => {
    outageConfig.file    = file
    outageConfig.aborted = aborted
}

/*  an interruptible pause, which ends early once the scheduling was aborted  */
export const pause = async (ms: number): Promise<void> => {
    const end = Date.now() + ms
    for (let left = ms; left > 0; left = end - Date.now()) {
        if (outageConfig.aborted())
            break
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(1000, left)))
    }
}

/*  the gateway outage state: a gateway error pauses every worker of every runner
    until "until" (60 s doubling per consecutive outage up to 300 s, plus a jitter,
    so not all workers hit the recovering gateway at once), and an ordinary run
    resets the streak  */
type Outage = { until: number, streak: number }
const outageRead = (): Outage => {
    if (outageConfig.file === "")
        return { until: 0, streak: 0 }
    try {
        const data = JSON.parse(fs.readFileSync(outageConfig.file, "utf8")) as Partial<Outage>
        return { until: Number(data.until ?? 0), streak: Number(data.streak ?? 0) }
    }
    catch (_err) {
        return { until: 0, streak: 0 }
    }
}
const outageWrite = (outage: Outage): void => {
    if (outageConfig.file === "")
        return
    fs.mkdirSync(path.dirname(outageConfig.file), { recursive: true })
    const tmp = `${outageConfig.file}.${process.pid}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(outage), "utf8")
    fs.renameSync(tmp, outageConfig.file)
}
export const outageMark = (): void => {
    const now    = Date.now()
    const prev   = outageRead()
    if (prev.until > now)
        return
    const streak = prev.streak + 1
    const ms     = Math.min(60 * 2 ** (streak - 1), 300) * 1000 + Math.random() * 10 * 1000
    outageWrite({ until: now + ms, streak })
    console.log(chalk.yellow(`⏸ gateway outage (#${streak}) -- pausing all workers ${Math.round(ms / 1000)}s`))
}
export const outageReset = (): void => {
    const prev = outageRead()
    if (prev.streak > 0 && prev.until <= Date.now())
        outageWrite({ until: 0, streak: 0 })
}
export const outageWait = async (): Promise<void> => {
    const ms = outageRead().until - Date.now()
    if (ms > 0)
        await pause(ms)
}
