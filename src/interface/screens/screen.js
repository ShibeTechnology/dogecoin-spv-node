const EventEmitter = require('events')

/*
  Abstract class to help define a screen.
*/
class Screen extends EventEmitter {
  constructor () {
    super()

    this.numberOfLines = 0
    this.cursorPosition = 0
    this.lock = false
  }

  keyPressed (key) {
    throw new TypeError('`keyPressed` function has to be defined.')
  }

  format () {
    throw new TypeError('`format` function has to be defined.')
  }

  update () {
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
      this.format()
    })
  }
}

module.exports = Screen
