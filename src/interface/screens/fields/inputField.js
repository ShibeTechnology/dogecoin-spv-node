const terminalStyle = require('../../terminalStyle')

class InputField {
  constructor (value) {
    this.value = value
  }

  renderField (selected) {
    if (selected) {
      return `${terminalStyle.WHITE_BACKGROUND}${terminalStyle.BLACK}${terminalStyle.BOLD}${this.value}${terminalStyle.RESET}\x1b[K`
    }
    return this.value
  }
}

module.exports = InputField
