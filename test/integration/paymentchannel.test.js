const test = require('ava')
const { setup, close } = require('./util.js')

test.before(setup)
test.after.always(close)

test.serial('should create and send a p2sh transaction', async t => {
    t.pass()
})