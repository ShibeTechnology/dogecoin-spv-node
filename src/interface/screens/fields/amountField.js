const InputField = require('./inputField')
const KEYS = require('../../keys')

class AmountField extends InputField {
  constructor (amount = '0') {
    super(amount)
  }

  setValue (newAmount) {
    this.value = newAmount
  }

  handleChange (key) {
    let amount = this.value
    if (key === KEYS.RETURN && this.value.length > 0) {
      amount = this.value.slice(0, -1)
    } else {
      if (key in ['\u0030', '\u0031', '\u0032', '\u0033', '\u0034', '\u0035', '\u0036', '\u0037', '\u0038', '\u0039']) {
        // If not a number someone is drunk
        if (this.value === '_' || this.value === '0') {
          amount = key
        } else {
          amount = this.value + key
        }
      }
    }

    if (amount.length === 0) { amount = '_' }

    this.setValue(amount)
  }
}

module.exports = AmountField
