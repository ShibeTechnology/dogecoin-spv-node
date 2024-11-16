const Docker = require('dockerode')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')
const { scheduler } = require('node:timers/promises')

const SPVNode = require('../../src/spvnode')
const networks = require('../../src/network')
const { getSettings } = require('../../src/settings')
const Wallet = require('../../src/wallet')

const regtest = {
  messagePrefix: '\x18Dogecoin Signed Message:\n',
  bech32: 'tdge',
  bip32: {
    public: 0x0432a9a8,
    private: 0x0432a243
  },
  pubKeyHash: 0x6f,
  scriptHash: 0xc4,
  wif: 0xef
}

async function setup (t) {
  // setup files
  const settings = getSettings(networks.REGTEST)

  const mnemonic = 'neutral acoustic balance describe access pitch tourist skull recycle nation silent crawl'

  // Test data folder
  const folderName = `data${Date.now()}`
  settings.DATA_FOLDER = path.join(__dirname, folderName)
  const SEED_FILE = path.join(settings.DATA_FOLDER, 'seed.json')

  if (!fs.existsSync(settings.DATA_FOLDER)) {
    fs.mkdirSync(settings.DATA_FOLDER, { recursive: true })
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
    fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
    // Create redemscript file
    fs.writeFileSync(path.join(settings.DATA_FOLDER, 'redeemscripts.json'), JSON.stringify([]))
  }

  if (!fs.existsSync(SEED_FILE)) {
    Wallet.createSeedFile(mnemonic, SEED_FILE)
  }

  const wallet = new Wallet(settings)
  await wallet.init()
  const pubkeyshash = await wallet.getAllpubkeyHashes()

  const spvnode = new SPVNode(pubkeyshash, settings)

  // Start Dogecoin docker node
  const docker = new Docker()

  // Create tmp folder
  const dockerDataPath = path.join('/tmp', folderName)
  fs.mkdirSync(dockerDataPath)

  const container = await docker.createContainer({
    Image: 'rllola/dogecoind:v1.14.6',
    HostConfig: {
      Mounts: [{
        Source: dockerDataPath,
        Target: '/mnt/data',
        Type: 'bind'
      }, {
        Source: `${process.cwd()}/dogecoin.conf`,
        Target: '/mnt/dogecoin.conf',
        Type: 'bind'
      }],
      PublishAllPorts: true
    }
  })

  t.log('container created')

  await container.start({})

  settings.DEFAULT_PORT = (await container.inspect()).NetworkSettings.Ports['18444/tcp'][0].HostPort

  t.log('container started')
  // still need to wait after starting...
  await scheduler.wait(2000)

  const containerName = (await container.inspect()).Name.replace('/', '')
  await new Promise(function (resolve, reject) {
    // timeout after 10 seconds
    setTimeout(reject, 10000)

    // check health on the node every second
    setInterval(function () {
      const result = execSync(`docker exec ${containerName} dogecoin-cli -conf=/mnt/dogecoin.conf getbalance`)
      if (!result.toString().includes('error code: -28')) {
        t.log(`container ${containerName} is up`)

        clearInterval(this)
        resolve()
      }
    }, 1000)
  })

  t.context = { spvnode, settings, container, wallet }
}

async function close (t) {
  t.log('Tests done')
  const { settings, container } = t.context

  // Clean after
  fs.rmSync(settings.DATA_FOLDER, { recursive: true })

  const containerName = (await container.inspect()).Name.replace('/', '')

  t.log(`stopping ${containerName}`)
  await container.stop()
  t.log(`removing ${containerName}`)
  await container.remove()
}

module.exports = { setup, close, regtest }
