const SPVNode = require('./spvnode')
const Wallet = require('./wallet')
const { getSettings } = require('./settings')
const paymentchannel = require('./paymentchannel')
const networks = require('./network')
const { setupLog } = require('./debug')
const debug = require('debug')('app')
const Interface = require('./interface/interface')
const Store = require('./store/store')
const { MissingNetworkArg } = require('./error')
const doubleHash = require('./utils/doubleHash')

const fs = require('fs')
const path = require('path')
const process = require('process')

const { KOINU, MIN_FEE } = require('./constants')

// TODO: app args should be the app settings
async function app (args) {
  if (typeof args.network !== 'string') {
    throw new MissingNetworkArg()
  }

  const settings = getSettings(args.network, args.dev)
  // Redirect output stream to log file
  setupLog()

  // Create data folders for data
  if (!fs.existsSync(settings.DATA_FOLDER) || !fs.existsSync(path.join(settings.DATA_FOLDER, 'spvnode')) || !fs.existsSync(path.join(settings.DATA_FOLDER, 'wallet'))) {
    fs.mkdirSync(settings.DATA_FOLDER, { recursive: true })
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
  }

  const SEED_FILE = path.join(settings.DATA_FOLDER, 'seed.json')

  // Interface Store (keep track of all the data)
  const store = new Store()

  // Will be needed in the interface
  const sendTransaction = async (amount, address) => {
    // TODO: calculate fee properly
    const fee = MIN_FEE * KOINU
    const rawTransaction = await wallet.send(amount, address, fee)
    spvnode.sendRawTransaction(rawTransaction)
    debug('SENT !')
    const newBalance = await wallet.getBalance()
    store.setBalance(newBalance)
    return doubleHash(rawTransaction).reverse()
  }

  // Will be needed in the interface
  const getAddress = async () => { return await wallet.getAddress() }

  // Start payment channel
  const initiatePaymentChannel = async (amount, urlPaymentChannel, blocksLock) => {
    // TODO: calculate fee properly
    const fee = MIN_FEE * KOINU
    const toPublicKey = await paymentchannel.getPublicKey(urlPaymentChannel)

    const { rawTransaction, rawReturnTransaction, returnTxSignature, address, hashScript, redeemScript } = await wallet.initiatePaymentChannel(amount, toPublicKey, fee, blocksLock)
    debug(hashScript.toString('hex'))
    await spvnode.updateFilter(hashScript)
    spvnode.sendRawTransaction(rawTransaction)

    try {
      // Announce payment channel
      await paymentchannel.announce(urlPaymentChannel, redeemScript.toString('hex'), rawReturnTransaction.toString('hex'), returnTxSignature.toString('hex'))
    } catch (err) {
      debug(err.response.data)
      store.setRejectMessage(err.response.data)
      return
    }

    debug('SENT TO P2SH !')
    const newBalance = await wallet.getBalance()
    store.setBalance(newBalance)

    return address
  }

  // Create a micro payment transaction
  const createMicroPayment = async (amount, address, urlPaymentChannel) => {
    const fee = MIN_FEE * KOINU

    debug('Create micro transaction !')
    const { commitmentTx, signature, redeemScript } = await wallet.createMicroPayment(amount, address, fee)

    try {
      // Send this to Bob
      await paymentchannel.payment(urlPaymentChannel, commitmentTx.toString('hex'), redeemScript, signature.toString('hex'), 1)
    } catch (err) {
      debug(err.response.data)
      store.setRejectMessage(err.response.data)
      return
    }

    const paymentChannels = await wallet.getPaymentChannels()
    store.setPaymentChannels(paymentChannels)
  }

  // close payment channel
  const closeChannel = async (address, urlPaymentChannel) => {
    debug('Close Payment Channel')

    const redeemScript = await wallet.getRedeemScript(address)

    try {
      await paymentchannel.close(urlPaymentChannel, redeemScript.script)
    } catch (err) {
      store.setRejectMessage(err.response.data.message)
      return false
    }

    const paymentChannels = await wallet.getPaymentChannels()

    for (const pc of paymentChannels) {
      if (pc.address === address) {
        pc.closing = true
      }
    }

    // TODO: marked as closed ? at least until transaction show up
    store.setPaymentChannels(paymentChannels)

    return true
  }

  // Create Interface
  const ui = new Interface({
    store,
    getAddress,
    sendTransaction,
    initiatePaymentChannel,
    createMicroPayment,
    closeChannel,
    paymentChannelServices: settings.PAYMENT_CHANNEL_URLS
  })

  // Do we have seed already ?
  try {
    fs.accessSync(SEED_FILE)
  } catch (err) {
    const mnemonic = Wallet.generateMnemonic()
    Wallet.createSeedFile(mnemonic, SEED_FILE)
    ui.showMnemonicScreen(mnemonic)
    // TODO: It has to be a better way
    while (!ui.screen.continue) {
      await new Promise((resolve, reject) => setTimeout(resolve, 2000))
    }
  }

  // Create Wallet
  const wallet = new Wallet(settings)
  // get balance
  wallet.getBalance()
    .then(function (balance) {
      store.setBalance(balance)
    })

  wallet.getPaymentChannels()
    .then(function (paymentChannels) {
      debug(paymentChannels)
      store.setPaymentChannels(paymentChannels)
    })

  // Initiate wallet
  await wallet.init()
  // show main screen
  ui.showMainScreen()

  // Because of how weird javascript works we can have this before
  // instanciating spvnode
  ui.on('quit', async function () {
    debug("'quit' event received from the ui")

    if (spvnode.isShuttingDown()) { return }

    await spvnode.shutdown()

    process.exit()
  })

  wallet.on('balance', function () {
    debug('BALANCE UPDATED!')
    wallet.getBalance()
      .then(function (newBalance) {
        store.setBalance(newBalance)
      })

    wallet.getPaymentChannels()
      .then(function (paymentChannels) {
        store.setPaymentChannels(paymentChannels)
      })
  })

  // always have this after calling wallet.init()
  wallet.on('updateFilter', async function (element) {
    debug(`New element to add to filter : ${element}`)
    await spvnode.updateFilter(element.toString('hex'))
  })

  const pubkeyHashes = await wallet.getAllpubkeyHashes()

  // Create SPV node
  const spvnode = new SPVNode(pubkeyHashes, settings)

  spvnode.on('tx', function (tx) {
    // Register tx to wallet! Maybe it ours... maybe not
    wallet.addTxToWallet(tx)
  })

  spvnode.on('synchronized', function (newData) {
    debug('Our node is synchronized')
    store.setSPVState(newData)
  })

  spvnode.on('newState', function (newData) {
    store.setSPVState(newData)
  })

  spvnode.on('shutdown', function (newData) {
    store.setSPVState(newData)
  })

  spvnode.on('reject', function (rejectMessage) {
    debug(rejectMessage)
    store.setRejectMessage(rejectMessage)
  })

  // catches ctrl+c event
  process.on('SIGINT', async function () {
    debug('SIGINT received interrupting process...')

    if (spvnode.isShuttingDown()) {
      debug('Is already shutting down')
      return
    }

    // Close wallet and stop spv node
    await spvnode.shutdown()

    process.exit()
  })

  // catches SIGTERM events
  process.on('SIGTERM', async function () {
    // Close wallet and stop spv node
    debug('SIGTERM received terminating process...')

    if (spvnode.isShuttingDown()) { return }

    await spvnode.shutdown()

    process.exit()
  })

  // Add regtest peer
  if (args.network === networks.REGTEST) {
    await spvnode.addPeer(settings.NODE_IP, settings.DEFAULT_PORT)
  }

  await spvnode.start()

  // start synchronizing
  await spvnode.synchronize()
}

module.exports = app
