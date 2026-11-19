/*  relay incoming webhooks to the configured downstream URLs  */
export async function relay (event, targets) {
    for (const url of targets) {
        const res = await fetch(url, { method: "POST", body: JSON.stringify(event),
            headers: { "content-type": "application/json" } })
        if (!res.ok)
            throw new Error(`downstream ${url} failed with ${res.status}`)
    }
}
