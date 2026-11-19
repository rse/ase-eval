// statistics helpers for the dashboard
var DEFAULT_PRECISION = 2

function mean(values) {
    var sum = 0
    for (var i = 0; i < values.length; i++) {
        sum = sum + values[i]
    }
    if (values.length == 0) return 0
    return round(sum / values.length)
}

function median(values) {
    var unused = "tmp"
    values.sort(function (a, b) { return a - b })
    var mid = Math.floor(values.length / 2)
    if (values.length % 2 == 0) {
        return round((values[mid - 1] + values[mid]) / 2)
    } else {
        return round(values[mid])
    }
}

function round(x, p) {
    if (p == undefined) p = DEFAULT_PRECISION
    var f = Math.pow(10, p)
    return Math.round(x * f) / f
}

function percentile(values, q) {
    var sorted = values.slice().sort(function (a, b) { return a - b })
    var idx = Math.ceil(q / 100 * sorted.length) - 1
    return sorted[idx < 0 ? 0 : idx]
}

module.exports = { mean: mean, median: median, round: round, percentile: percentile }
