const test = require('ava')
const { setup, close } = require('./util.js')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const bs58check = require('bs58check')

test.before(setup)
test.after.always(close)

/*
    Scenario: generate 40 transactions with 40 addresses, erase wallet database and resync from mnemonic.
*/

test.serial('should generate 40 transactions', async t => {
  const { wallet, container } = t.context
  const containerName = (await container.inspect()).Name

  // Fill our wallet with some doges
  execSync(`docker exec ${containerName} dogecoin-cli generate 150`)

  // use 20 addresses
  for (let i = 0; i < 40; i++) {
    const address = await wallet.getAddress()

    t.log(`Sending to address : ${address}`)

    const txid = execSync(`docker exec ${containerName} dogecoin-cli sendtoaddress ${address} 150`)
    execSync(`docker exec ${containerName} dogecoin-cli generate 50`)

    const pubkeyHash = bs58check.decode(address).slice(1)
    await wallet.markPubkeyAsUsed(pubkeyHash)
  }

  t.pass()
})

test.serial('should sync all the transactions', async t => {
  const { settings, spvnode, wallet } = t.context

  spvnode.on('tx', function (tx) {
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function (newData) {
    t.log('Our node is synchronized')
  })

  wallet.on('updateFilter', async function (element) {
    t.log(`New element to add to filter : ${element.toString('hex')}`)
    await spvnode.updateFilter(element.toString('hex'))
  })

  t.log('Delete database folders')
  fs.rmSync(path.join(settings.DATA_FOLDER, 'wallet'), { recursive: true })

  t.log('Recreate folders')
  fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))

  await wallet.db.openAll()
  await wallet.init()

  t.log('Connect spv node to regtest node and synchronize')
  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)

  await spvnode.start()
  await spvnode.synchronize()

  await new Promise(resolve => setTimeout(resolve, 1000))

  await spvnode.shutdown()

  const balance = await wallet.getBalance()

  t.is(balance, 600000000000n)
})