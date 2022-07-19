const Screen = require('./screen')
const debug = require('debug')('paymentChannelScreen')
const KEYS = require('../keys')
const { KOINU } = require('../../constants')
const { AmountField } = require('./fields')

const InputFields = {
  None: 0,
  AmountField: 1
}

/*
  Micro Payment Screen
*/
class MicroPaymentScreen extends Screen {
  constructor (args) {
    super()

    debug('Making a payment throught a payment channel')

    if (typeof args.address !== 'string') {
      throw new Error('No Payment Channel address.')
    }

    if (typeof args.createMicroPayment !== 'function') {
      throw new Error('Missing "createMicroPayment" function.')
    }

    if (typeof args.displayMainScreen !== 'function') {
      throw new Error('Missing "displayMainScreen" function.')
    }

    if (typeof args.paymentChannelUrl !== 'string') {
      throw new Error('"paymentChannelUrl" must be a string.')
    }

    this.address = args.address
    this.createMicroPayment = args.createMicroPayment
    this.displayMainScreen = args.displayMainScreen
    this.paymentChannelUrltechnology = args.paymentChannelUrl

    // input fields
    this.amountField = new AmountField('0')
    this.selected = InputFields.None

    this.format()
  }

  keyPressed (key) {
    let selected

    switch (key) {
      case KEYS.UP:
        selected = this.selected - 1 < 0 ? 1 : this.selected - 1
        this.setSelected(selected)
        break
      case KEYS.DOWN:
        selected = this.selected + 1 > 2 ? 0 : this.selected + 1
        this.setSelected(selected)
        break
      case KEYS.ENTER:
        this.sendPaymentChannel()
        return false
      default:
        return this.modifyInputsField(key)
    }
  }

  modifyInputsField (key) {
    switch (this.selected) {
      case InputFields.AmountField:
        this.amountField.handleChange(key)
        this.update()
        return false
      default:
        return true
    }
  }

  async sendPaymentChannel () {
    this.displayMainScreen()
    await this.createMicroPayment(BigInt(this.amountField.value) * KOINU, this.address, this.paymentChannelUrl)
  }

  format () {
    const layout = `================ MICRO PAYMENT ================

  Amount: ${this.amountField.renderField(this.selected === InputFields.AmountField)} Ð
  Payment channel address: ${this.address}

  Press "Enter" to make payment
  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }

  setSelected (newValue) {
    this.selected = newValue

    this.update()
  }
}

module.exports = MicroPaymentScreen
