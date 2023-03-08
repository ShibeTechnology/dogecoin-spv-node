const CompactSize = require('../utils/compactSize')
const decodeHeader = require('../utils/decodeHeader')
const { decodeTxMessage, decodeTxIn, decodeTxOut } = require('./tx')

const BLOCK_VERSION_AUXPOW_BIT = 0x100

function decodeBlockMessage (payload) {
  const block = {}
  let offset = 0

  block.blockHeader = decodeHeader(payload.slice(offset, offset + 80))
  offset += 80

  block.auxPoWHeader = null
  if ((block.blockHeader.version & BLOCK_VERSION_AUXPOW_BIT) !== 0) {
    const auxPoWHeader = {
      coinbase: {},
      parentHash: null,
      coinbaseLinks: null,
      coinbaseBitMask: null,
      auxBlockchainLinks: null,
      auxBlockchainBitMask: null,
      parentHeader: null
    }

    // AuxPoW block
    auxPoWHeader.coinbase.version = payload.readInt32LE(offset)
    offset += 4

    const countTxIns = CompactSize.fromBuffer(payload, offset)
    offset += countTxIns.offset

    // loop for txins
    const txIns = []
    for (let i = 0; i < countTxIns.size; i++) {
      const { txIn, size } = decodeTxIn(payload.slice(offset))
      offset += size

      txIns.append(txIn)
    }

    auxPoWHeader.coinbase.txIns = txIns

    const countTxOuts = CompactSize.fromBuffer(payload, offset)
    offset += countTxOuts.offset

    // loop for txouts
    const txOuts = []
    for (let i = 0; i < countTxOuts.size; i++) {
      const { txOut, size } = decodeTxOut(payload.slice(offset))
      offset += size

      txOuts.append(txOut)
    }

    auxPoWHeader.coinbase.txOuts = txOuts

    auxPoWHeader.coinbase.lockTime = payload.readInt32LE(offset)
    offset += 4

    auxPoWHeader.parentHash = payload.slice(offset, offset + 32)
    offset += 32

    // COINBASE LINK

    let countMerkleHash = CompactSize.fromBuffer(payload, offset)
    offset += countMerkleHash.offset
    // loop for merkle hashes
    let merkleHashes = []
    for (let i = 0; i < countMerkleHash.size; i++) {
      const merkleHash = payload.slice(offset, offset + 32)
      offset += 32

      merkleHashes.append(merkleHash)
    }

    auxPoWHeader.coinbaseLinks = merkleHashes

    auxPoWHeader.coinbaseBitMask = payload.readInt32LE(offset)
    offset += 4

    // AUX BLOCKCHAIN LINK

    countMerkleHash = CompactSize.fromBuffer(payload, offset)
    offset += countMerkleHash.offset
    // loop for merkle hashes
    merkleHashes = []
    for (let i = 0; i < countMerkleHash.size; i++) {
      const merkleHash = payload.slice(offset, offset + 32)
      offset += 32

      merkleHashes.append(merkleHash)
    }

    auxPoWHeader.auxBlockchainLinks = merkleHashes

    auxPoWHeader.auxBlockchainBitMask = payload.readInt32LE(offset)
    offset += 4

    auxPoWHeader.parentBlockHeader = payload.slice(offset, offset + 80)
    offset += 80
  }

  const compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  block.txnCount = compactSize.size

  block.txn = []
  for (let i = 0; i < block.txnCount; i++) {
    const tx = decodeTxMessage(payload.slice(offset, payload.length))
    offset += tx.size

    block.txn[i] = tx
  }

  return block
}

module.exports = { decodeBlockMessage }
