const Screen = require('./screen')

/*
  Dummy Screen... Doesn't show anything.
*/
class DummyScreen extends Screen {
  keyPressed (key) {
    return true
  }

  format () {

  }
}

module.exports = DummyScreen
