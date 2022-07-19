const Screen = require('./screen')
const { KOINU, MIN_FEE } = require('../../constants')
const KEYS = require('../keys')
const debug = require('debug')('sendDogeScreen')
const { AmountField, AddressField } = require('./fields')

const InputFields = {
  None: 0,
  AmountField: 1,
  AddressField: 2
}

class SendDogeScreen extends Screen {
  constructor (args) {
    super()

    if (typeof args.sendTransaction !== 'function' || typeof args.store !== 'object') {
      throw new Error("You need to define a 'sendTransaction' function and a 'store' object.")
    }

    this.sendTransaction = args.sendTransaction
    this.store = args.store

    // input fields
    this.toField = new AddressField()
    this.amountField = new AmountField('0')
    this.selected = InputFields.None

    this.format()

    // TODO: `rejected` event should throw error message instead of retrieving it from store
    this.store.on('rejected', () => {
      if (this.store.rejectMessage.message === 'tx') {
        const rejectMsg = `${this.store.rejectMessage.reason} (CODE ${this.store.rejectMessage.code})`
        process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
          this.update(rejectMsg)
        })
      }
    })
  }

  keyPressed (key) {
    let selected

    switch (key) {
      case KEYS.UP:
        selected = this.selected - 1 < 0 ? 2 : this.selected - 1
        this.setSelected(selected)
        break
      case KEYS.DOWN:
        selected = this.selected + 1 > 2 ? 0 : this.selected + 1
        this.setSelected(selected)
        break
      case KEYS.CTRL_V:
        this.pasteAddress()
        break
      case KEYS.ENTER:
        if (this.amountField.value === '_') {
          this.amountField.value = '0'
        }
        this._sendDogecoin(BigInt(this.amountField.value) * KOINU, this.toField.value)
        break
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
      case InputFields.AddressField:
        this.toField.handleChange(key)
        this.update()
        return false
      default:
        return true
    }
  }

  async _sendDogecoin (amount, address) {
    try {
      const transactionHash = await this.sendTransaction(amount, address)
      this.update('', `Sent ! ${transactionHash.toString('hex')}`)
    } catch (err) {
      debug(err)
      this.update(`Fail to send : ${err.message}`, '')
    }
  }

  setSelected (newValue) {
    this.selected = newValue

    this.update()
  }

  format (rejectMessage = '', successMessage = '') {
    const layout = `================ SEND DOGECOINS ================
  ${rejectMessage || successMessage}

  Current balance: ${this.store.balance / KOINU} Ð                   
  Fee: ${MIN_FEE} Ð

  Amount: ${this.amountField.renderField(this.selected === InputFields.AmountField)} Ð                                         
  To: ${this.toField.renderField(this.selected === InputFields.AddressField)}

  TIP: Do CTRL+V to copy address in the 'To' field.

  Press "Enter" to send
  Press "Return" to return to main screen
`
    this.numberOfLines = layout.split('\n').length

    process.stdout.write(layout)
  }

  update (rejectMessage = '', successMessage = '') {
    process.stdout.moveCursor(this.cursorPosition, -(this.numberOfLines - 1), () => {
      this.format(rejectMessage, successMessage)
    })
  }
}

module.exports = SendDogeScreen
