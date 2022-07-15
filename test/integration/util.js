const Docker = require('dockerode')
const path = require('path')
const fs = require('fs')

const SPVNode = require('../../src/spvnode')
const networks = require('../../src/network')
const { getSettings } = require('../../src/settings')
const Wallet = require('../../src/wallet')
const { pubkeyToAddress } = require('../../src/wallet/utils')

const TEST_VECTORS_DIR = path.join('.', 'test', 'test_vectors')

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
    let settings = getSettings(networks.REGTEST)

    const mnemonic = 'neutral acoustic balance describe access pitch tourist skull recycle nation silent crawl'
  
    // Test data folder
    settings.DATA_FOLDER = path.join(__dirname, `data${Date.now()}`)
    const SEED_FILE = path.join(settings.DATA_FOLDER, 'seed.json')

    if (!fs.existsSync(settings.DATA_FOLDER)) {
      fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
      fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
      fs.mkdirSync(path.join(settings.DATA_FOLDER, 'wallet'))
      // Create redemscript file
      fs.writeFileSync(path.join(settings.DATA_FOLDER, 'redeemscripts.json'), JSON.stringify([]))
    }

    if (!fs.existsSync(SEED_FILE)) {
      Wallet.createSeedFile(mnemonic, SEED_FILE)
    }  
    
    let wallet = new Wallet(settings)
    await wallet.init()
    let pubkeyshash =  await wallet.getAllpubkeyHashes()
  
    for (let pubkeyhash of pubkeyshash) {
      t.log(`Address : ${pubkeyToAddress(Buffer.from(pubkeyhash, 'hex'), settings.NETWORK_BYTE, true)}`)
    }

    var spvnode = new SPVNode(pubkeyshash, settings)
  
    // Start Dogecoin docker node
    const docker = new Docker()
  
    const container = await docker.createContainer({
      Image: 'dogecoind',
      HostConfig: {
        //NetworkMode: 'host',
        Mounts: [{
          Source :`${process.cwd()}/provision/dogecoind/dogecoin.conf`,
          Target: '/root/.dogecoin/dogecoin.conf',
          Type: 'bind'
        }],
        PublishAllPorts: true
        /*PortBindings: {
          '18444/tcp': [{ HostPort: '11022' }]
        },*/
      }
    })
  
    t.log('container created')
  
    await container.start({})

    settings.DEFAULT_PORT = (await container.inspect()).NetworkSettings.Ports['18444/tcp'][0].HostPort
  
    t.log('container started')
  
    // Wait 5 seconds
    // Needed otherwise we try to connect when node is not ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    t.context = { spvnode, settings, container, wallet }
}

async function close (t) {
    t.log('Tests done')
    const { settings, container } = t.context

    // Clean after
    fs.rmSync(settings.DATA_FOLDER, {recursive: true})
      
    await container.stop()
    await container.remove()
}

module.exports = { setup, close, regtest }