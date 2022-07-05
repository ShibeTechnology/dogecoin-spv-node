const test = require('ava')
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const { decodeTxMessage } = require('../../src/commands/tx')
const { setup, close, regtest } = require('./util.js')
const { ECPair } = require('bitcoinjs-lib')
const Wallet = require('../../src/wallet')


test.before(setup)
test.after.always(close)

test.serial('generate new pubkey that is not part of the filter (see issue #4)', async t => {
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

        let rawtx = execSync(`docker exec ${containerName} dogecoin-cli getrawtransaction ${txid.toString('utf8')}`)
        rawtx = rawtx.toString('utf8').replace('\n', '')
        const tx = decodeTxMessage(Buffer.from(rawtx, 'hex'))
        await wallet.addTxToWallet(tx)
    }

    // Get bob public key
    const bobKey = ECPair.fromPrivateKey(Buffer.from('3b187fd3a10960efe5753c9851c174c05bcdb30db22fd9deab981fe1f0ec7b00', 'hex'), {
        compressed: true,
        network: regtest
    })

    // create payment channel  
    t.log('Initiate payment channel')
    pctx = await wallet.initiatePaymentChannel(100n, bobKey.publicKey.toString('hex'), 1n, 200)
  
    const pctxid = execSync(`docker exec ${containerName} dogecoin-cli sendrawtransaction ${pctx.rawTransaction.toString('hex')}`)
    execSync(`docker exec ${containerName} dogecoin-cli generate 150`)

    await wallet.db.closeAll()

    t.pass()
})

test.serial('should register paymentchannel tx after deleting database', async t => {
    const { settings, spvnode, wallet } = t.context

    spvnode.on('tx', function (tx) {
      wallet.addTxToWallet(tx)
    })
  
    spvnode.on('synchronized', function (newData) {
      t.log('Our node is synchronized')
    })
  
    t.log('Delete database folders')
    fs.rmSync(path.join(settings.DATA_FOLDER, 'wallet'), {recursive: true})
  
    t.log('Recreate folders')
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))

    await wallet.db.openAll()
    await wallet.init()

    t.log('Connect spv node to regtest node and synchronize')
    await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
    await spvnode.start()
    await spvnode.synchronize()
  
    await new Promise(resolve => setTimeout(resolve, 1000))
  
    t.pass()
  })