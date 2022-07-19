const InputField = require('./inputField')
const KEYS = require('../../keys')

const EMPTY_FIELD = '_'

class AddressField extends InputField {
  constructor (address = EMPTY_FIELD) {
    super(address)
  }

  setValue (newValue) {
    this.value = newValue
  }

  handleChange (key) {
    let address = this.value
    if (key === KEYS.RETURN && this.value.length > 0) {
      address = this.value.slice(0, -1)
    } else {
      if (this.value === EMPTY_FIELD) {
        address = key
      } else {
        address = this.value + key
      }
    }

    if (address.length === 0) { address = EMPTY_FIELD }

    this.setValue(address)
  }
}

module.exports = AddressField
