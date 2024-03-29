const CompactSize = require('../utils/compactSize')
const decodeHeader = require('../utils/decodeHeader')
const { BLOCK_VERSION_AUXPOW_BIT } = require('./constants')

function decodeHeadersMessage (payload) {
  const headers = {}
  let offset = 0

  let compactSize = CompactSize.fromBuffer(payload, offset)

  headers.count = compactSize.size
  offset = compactSize.offset

  headers.headers = []

  for (let i = 0; i < headers.count; i++) {
    const header = decodeHeader(payload.slice(offset, offset + 80))
    offset += 80

    // Should be always 0x00
    // https://bitcoin.org/en/developer-reference#headers
    header.transactionCount = payload.readUInt8(offset)
    offset += 1

    // Same method as in block!
    if ((header.version & BLOCK_VERSION_AUXPOW_BIT) !== 0) {
      // this is happening
      // https://en.bitcoin.it/wiki/Merged_mining_specification

      delete header.transactionCount

      // It was not the transaction headers that we got
      offset -= 1

      const parentBlock = {}

      parentBlock.version = payload.readInt32LE(offset)
      offset += 4

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      parentBlock.txInCount = compactSize.size

      parentBlock.txIns = []

      for (let j = 0; j < parentBlock.txInCount; j++) {
        const txIn = {}

        txIn.previousOutput = payload.slice(offset, offset + 36).toString('hex')
        offset += 36

        compactSize = CompactSize.fromBuffer(payload, offset)
        offset += compactSize.offset

        txIn.scriptSize = compactSize.size

        if (typeof compactSize.size === 'bigint') {
          console.log('IT SHOULDNT BE A BIGINT')
        }

        txIn.script = payload.slice(offset, offset + compactSize.size).toString('hex')
        offset += compactSize.size

        txIn.sequence = payload.readUInt32LE(offset)
        offset += 4

        parentBlock.txIns.push(txIn)
      }

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      parentBlock.txOutCount = compactSize.size

      parentBlock.txOuts = []

      for (let j = 0; j < parentBlock.txOutCount; j++) {
        const txOut = {}

        // This is merge mining Tx value... Convert the value to string directly to avoid issue with BigInt/level
        txOut.value = payload.readBigUInt64LE(offset).toString()
        offset += 8

        compactSize = CompactSize.fromBuffer(payload, offset)
        offset += compactSize.offset

        txOut.pkScriptSize = compactSize.size

        txOut.pkScript = payload.slice(offset, offset + txOut.pkScriptSize).toString('hex')
        offset += compactSize.size

        parentBlock.txOuts.push(txOut)
      }

      parentBlock.locktime = payload.readUInt32LE(offset)
      offset += 4

      parentBlock.blockHash = payload.slice(offset, offset + 32).toString('hex')
      offset += 32

      const coinbaseBranch = {}

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      coinbaseBranch.branchLength = compactSize.size

      coinbaseBranch.branchHashes = []

      for (let j = 0; j < coinbaseBranch.branchLength; j++) {
        coinbaseBranch.branchHashes.push(payload.slice(offset, offset + 32).toString('hex'))
        offset += 32
      }

      coinbaseBranch.branchSideMask = payload.readInt32LE(offset)
      offset += 4

      parentBlock.coinbaseBranch = coinbaseBranch

      const blockchainBranch = {}

      compactSize = CompactSize.fromBuffer(payload, offset)
      offset += compactSize.offset

      blockchainBranch.branchLength = compactSize.size

      blockchainBranch.branchHashes = []

      for (let j = 0; j < blockchainBranch.branchLength; j++) {
        blockchainBranch.branchHashes.push(payload.slice(offset, offset + 32).toString('hex'))
        offset += 32
      }

      blockchainBranch.branchSideMask = payload.readInt32LE(offset)
      offset += 4

      parentBlock.blockchainBranch = blockchainBranch

      parentBlock.parentBlockHeader = payload.slice(offset, offset + 80).toString('hex')
      offset += 80

      header.parentBlock = parentBlock

      header.transactionCount = payload.readUInt8(offset)
      offset += 1
    }

    headers.headers.push(header)
  }

  return headers
}

module.exports = { decodeHeadersMessage }
