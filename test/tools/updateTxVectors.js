const fs = require('fs')

const data = fs.readFileSync('./test/test_vectors/tx.json', { encoding: 'utf-8' })

console.log(data)
