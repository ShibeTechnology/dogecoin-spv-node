const test = require('ava')
const { setup, close } = require('./util.js')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const bs58check = require('bs58check')

test.before(setup)
test.after.always(close)

/*
    Scenario part 1: the wallet has created more than 20 used addresses (the pre-generated ones when we init the wallet).
    Then we need to update the bloom filter with more addresses and see if we get the transactions for the new addresses.

    Scenario part 2: We delete the database and try to resync. We should have all the transactions.
*/

// new element to add to filter
var newHash

test.serial('should generate 20 transactions', async t => {
  const { wallet, container } = t.context
  const containerName = (await container.inspect()).Name

  // Fill our wallet with some doges
  execSync(`docker exec ${containerName} dogecoin-cli generate 150`)

  // use 20 addresses
  for (let i = 0; i < 20; i++) {
    const address = await wallet.getAddress()

    t.log(`Sending to address : ${address}`)

    const txid = execSync(`docker exec ${containerName} dogecoin-cli sendtoaddress ${address} 150`)
    execSync(`docker exec ${containerName} dogecoin-cli generate 50`)

    const pubkeyHash = bs58check.decode(address).slice(1)
    await wallet.markPubkeyAsUsed(pubkeyHash)
  }

  t.pass()
})


test.serial('should sync the 20 transcations', async t => {
  const { settings, spvnode, wallet } = t.context

  spvnode.on('tx', function (tx) {
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function (newData) {
    t.log('Our node is synchronized')
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

  t.is(balance, 300000000000n)
})

test.serial('should generate 1 more transaction', async t => {
  const { wallet, container } = t.context
  const containerName = (await container.inspect()).Name

  // Fill our wallet with some doges
  execSync(`docker exec ${containerName} dogecoin-cli generate 150`)

  const address = await wallet.generateAddress()
  newHash = bs58check.decode(address).slice(1).toString('hex')

  t.log(`Sending to address : ${address}`)

  const txid = execSync(`docker exec ${containerName} dogecoin-cli sendtoaddress ${address} 150`)
  execSync(`docker exec ${containerName} dogecoin-cli generate 50`)
  t.log(`Transcation ID: ${txid.toString('utf8')}`)

  t.pass()
})

test.serial('should sync the 21st transaction', async t => {
  const { settings, spvnode, wallet } = t.context

  spvnode.on('tx', function (tx) {
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function (newData) {
    t.log('Our node is synchronized')
  })

  t.log('Delete database folders')
  fs.rmSync(path.join(settings.DATA_FOLDER, 'wallet'), { recursive: true })

  t.log('Recreate folders')
  fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))

  await wallet.db.openAll()
  await wallet.init()

  t.log('Connect spv node to regtest node and synchronize')
  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
  
  // add new key to filter to all nodes
  t.log(`new Hash : ${newHash}`)
  await spvnode.updateFilter(newHash)

  await spvnode.start()
  await spvnode.synchronize()

  await new Promise(resolve => setTimeout(resolve, 1000))

  await spvnode.shutdown()

  const balance = await wallet.getBalance()

  t.is(balance, 315000000000n)
})