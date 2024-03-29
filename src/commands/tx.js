const CompactSize = require('../utils/compactSize')
const doubleHash = require('../utils/doubleHash')

// TODO : Same code than for block !!!!
function decodeTxMessage (payload) {
  const tx = {}
  let offset = 0

  tx.id = doubleHash(payload).toString('hex')

  tx.version = payload.readUInt32LE(offset)
  offset += 4

  let compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  tx.txInCount = compactSize.size

  tx.txIns = []
  for (let i = 0; i < tx.txInCount; i++) {
    const { txIn, size } = decodeTxIn(payload.slice(offset))
    offset += size

    tx.txIns.push(txIn)
  }

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset
  tx.txOutCount = compactSize.size

  tx.txOuts = []
  for (let j = 0; j < tx.txOutCount; j++) {
    const { txOut, size } = decodeTxOut(payload.slice(offset))
    offset += size

    tx.txOuts.push(txOut)
  }

  tx.locktime = payload.readUInt32LE(offset)
  offset += 4

  tx.size = offset

  return tx
}

function encodeRawTransaction (transaction) {
  const txInCount = CompactSize.fromSize(transaction.txIns.length)
  const txOutCount = CompactSize.fromSize(transaction.txOuts.length)
  let bufferSize = 4 + txInCount.length

  for (let txIn = 0; txIn < transaction.txIns.length; txIn++) {
    bufferSize += 32 + 4 + transaction.txIns[txIn].signatureSize.length + transaction.txIns[txIn].signature.length + 4
  }

  bufferSize += txOutCount.length

  for (let txOut = 0; txOut < transaction.txOuts.length; txOut++) {
    bufferSize += 8 + CompactSize.fromSize(transaction.txOuts[txOut].pkScriptSize).length + transaction.txOuts[txOut].pkScriptSize
  }

  bufferSize += 4

  const buffer = Buffer.alloc(bufferSize)
  let offset = 0

  buffer.writeUInt32LE(transaction.version, offset)
  offset += 4

  txInCount.copy(buffer, offset)
  offset += txInCount.length

  for (let txInIndex = 0; txInIndex < transaction.txIns.length; txInIndex++) {
    Buffer.from(transaction.txIns[txInIndex].previousOutput.hash, 'hex').copy(buffer, offset)
    offset += 32

    buffer.writeUInt32LE(transaction.txIns[txInIndex].previousOutput.index, offset)
    offset += 4

    const scriptSigSize = CompactSize.fromSize(transaction.txIns[txInIndex].signature.length)
    scriptSigSize.copy(buffer, offset)
    offset += scriptSigSize.length

    transaction.txIns[txInIndex].signature.copy(buffer, offset)
    offset += transaction.txIns[txInIndex].signature.length

    buffer.writeUInt32LE(transaction.txIns[txInIndex].sequence, offset)
    offset += 4
  }

  txOutCount.copy(buffer, offset)

  offset += txOutCount.length

  for (let txOutIndex = 0; txOutIndex < transaction.txOuts.length; txOutIndex++) {
    buffer.writeBigInt64LE(transaction.txOuts[txOutIndex].value, offset)
    offset += 8

    const pkScriptSize = CompactSize.fromSize(transaction.txOuts[txOutIndex].pkScriptSize)

    pkScriptSize.copy(buffer, offset)
    offset += pkScriptSize.length

    transaction.txOuts[txOutIndex].pkScript.copy(buffer, offset)
    offset += transaction.txOuts[txOutIndex].pkScriptSize
  }

  buffer.writeUInt32LE(transaction.locktime, offset)
  offset += 4

  return buffer
}

function decodeTxIn (payload) {
  const txIn = {}
  let offset = 0

  txIn.previousOutput = {}

  txIn.previousOutput.hash = payload.slice(offset, offset + 32).toString('hex')
  offset += 32

  txIn.previousOutput.index = payload.slice(offset, offset + 4).toString('hex')
  offset += 4

  if (txIn.previousOutput.hash === '0000000000000000000000000000000000000000000000000000000000000000') {
    // Coinbase txIn !!!!!!!!
    const compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    txIn.script = payload.slice(offset, offset + compactSize.size).toString('hex')
    offset += compactSize.size

    txIn.sequence = payload.readUInt32LE(offset)
    offset += 4
  } else {
    // NOT Coinbase txIn !!!!!!!!
    const compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    txIn.signature = payload.slice(offset, offset + compactSize.size).toString('hex')
    offset += compactSize.size

    txIn.sequence = payload.readUInt32LE(offset)
    offset += 4
  }

  return { txIn, size: offset }
}

function decodeTxOut (payload) {
  const txOut = {}
  let offset = 0

  txOut.value = payload.readBigUInt64LE(offset)
  offset += 8

  const compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  txOut.pkScriptSize = compactSize.size

  txOut.pkScript = payload.slice(offset, offset + txOut.pkScriptSize)
  offset += compactSize.size

  return { txOut, size: offset }
}

module.exports = { decodeTxMessage, encodeRawTransaction, decodeTxIn, decodeTxOut }
