const Docker = require('dockerode')
const path = require('path')
const fs = require('fs')

const SPVNode = require('../../src/spvnode')
const networks = require('../../src/network')
const { getSettings } = require('../../src/settings')

const TEST_VECTORS_DIR = path.join('.', 'test', 'test_vectors')

async function setup (t) {
    let data = fs.readFileSync(path.join(TEST_VECTORS_DIR, 'pubkeyshash.json'), { encoding: 'utf-8' })
    let pubkeyshash =  JSON.parse(data)
  
    // setup files
    let settings = getSettings(networks.REGTEST)
  
    // Test data folder
    settings.DATA_FOLDER = path.join(__dirname, `data${Date.now()}`)
  
    if (!fs.existsSync(settings.DATA_FOLDER)) {
      fs.mkdirSync(settings.DATA_FOLDER, {recursive: true})
      fs.mkdirSync(path.join(settings.DATA_FOLDER, 'spvnode'))
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

    settings.DEFAULT_PORT = 11022
  
    t.log('container created')
  
    await container.start({})

    settings.DEFAULT_PORT = (await container.inspect()).NetworkSettings.Ports['18444/tcp'][0].HostPort
  
    t.log('container started')
  
    // Wait 5 seconds
    // Needed otherwise we try to connect when node is not ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    t.context = { spvnode, settings, container }
}

async function close (t) {
    t.log('Tests done')
    const { settings, container } = t.context

    // Clean after
    fs.rmSync(settings.DATA_FOLDER, {recursive: true})
      
    await container.stop()
    await container.remove()
}

module.exports = { setup, close }