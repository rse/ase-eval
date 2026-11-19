const s = require("./src/stats")
const data = [ 5, 1, 4, 2, 3, 10 ]
console.log(s.mean([]), s.mean([ 1, 2, 4 ]), s.round(2.345), s.round(2.3456, 3))
console.log(s.median([ 3, 1, 2 ]), s.median([ 4, 1, 3, 2 ]))
console.log(s.percentile(data, 50), s.percentile(data, 90), s.percentile(data, 0))
