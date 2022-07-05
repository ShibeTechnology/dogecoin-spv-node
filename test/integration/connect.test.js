const test = require('ava')
const { setup, close } = require('./util.js')

test.before(setup)
test.after.always(close)

test.serial('should connect to regtest node', async t => {
  const { spvnode, settings } = t.context

  t.log(`Connecting peer to ${settings.NODE_IP}:${settings.DEFAULT_PORT}`)
  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
  t.log('Peer connected')

  t.pass()
})