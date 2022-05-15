const test = require('ava')
const { setup, close } = require('./util.js')

test.before(setup)
test.after.always(close)

test.serial('should connect to regtest node', async t => {
  let spvnode = t.context.spvnode
  let settings =  t.context.settings

  t.log(`Connecting peer to ${settings.NODE_IP}:${settings.DEFAULT_PORT}`)

  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)

  t.log('Peer connected')

  t.pass()
})

test.todo('should send version message to regtest node')