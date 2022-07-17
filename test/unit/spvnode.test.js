const test = require('ava')
const { getSettings } = require('../../src/settings')
const path = require('path')
const networks = require('../../src/network')

test.before(t => {
  // setup files
  const settings = getSettings(networks.REGTEST)

  // Test data folder
  settings.DATA_FOLDER = path.join(__dirname, 'data')

  t.log(settings)
})

test.todo('wow')
