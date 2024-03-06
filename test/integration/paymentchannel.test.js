const test = require('ava')
const fs = require('fs')
const path = require('path')
const { ECPair } = require('bitcoinjs-lib')
const { setup, close, regtest } = require('./util.js')
const { execSync } = require('child_process')
const { decodeTxMessage } = require('../../src/commands/tx')

test.before(setup)
test.after.always(close)

let pctx

test.serial('should create and send a p2sh transaction', async t => {
  const { wallet, container } = t.context
  const address = await wallet.getAddress()
  const bobKey = ECPair.fromPrivateKey(Buffer.from('3b187fd3a10960efe5753c9851c174c05bcdb30db22fd9deab981fe1f0ec7b00', 'hex'), {
    compressed: true,
    network: regtest
  })

  const containerName = (await container.inspect()).Name

  t.log('Funding wallet with 150 Doges')
  execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf generate 150`)
  const txid = execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf sendtoaddress ${address} 150`)
  execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf generate 150`)

  t.log('Retrieve raw tx to add to wallet')
  let rawtx = execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf getrawtransaction ${txid.toString('utf8')}`)
  rawtx = rawtx.toString('utf8').replace('\n', '')
  const tx = decodeTxMessage(Buffer.from(rawtx, 'hex'))
  await wallet.addTxToWallet(tx)

  t.log('Initiate payment channel')
  pctx = await wallet.initiatePaymentChannel(100n, bobKey.publicKey.toString('hex'), 1n, 200)

  execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf sendrawtransaction ${pctx.rawTransaction.toString('hex')}`)
  execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf generate 150`)

  t.pass()
})

test.serial.skip('should create a commitment tx', async t => {
  const { wallet } = t.context

  t.log('Add payment channel tx to wallet')
  const pctransaction = decodeTxMessage(Buffer.from(pctx.rawTransaction, 'hex'))
  await wallet.addTxToWallet(pctransaction)
  t.log('Create micropayment')
  await wallet.createMicroPayment(2n, pctx.address, 1n)

  t.pass()
})

test.serial.skip('should register paymentchannel tx after deleting database', async t => {
  const { settings, spvnode, wallet } = t.context
  t.timeout(20000)

  t.log('Listen to tx events')
  spvnode.on('tx', function (tx) {
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function (newData) {
    t.log('Our node is synchronized')
  })

  t.log('Delete database folders')
  fs.rmSync(path.join(settings.DATA_FOLDER, 'spvnode'), { recursive: true })
  fs.rmSync(path.join(settings.DATA_FOLDER, 'wallet'), { recursive: true })
  fs.rmSync(path.join(settings.DATA_FOLDER, 'redeemscripts.json'))

  t.log('Connect spv node to regtest node and synchronize')
  await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
  await spvnode.start()
  await spvnode.synchronize()

  await new Promise(resolve => setTimeout(resolve, 1000))

  t.pass()
})

test.serial.skip('should create a commitment tx (2)', async t => {
  const { wallet } = t.context

  t.log('Create micropayment')
  await wallet.createMicroPayment(2n, pctx.address, 1n)

  t.pass()
})
