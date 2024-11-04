const CompactSize = require('../utils/compactSize')
const decodeHeader = require('../utils/decodeHeader')
const { BLOCK_VERSION_AUXPOW_BIT } = require('./constants')

function decodeMerkleblockMessage (payload) {
  const merkleblock = {}
  let offset = 0
  let compactSize

  // Normal header
  merkleblock.blockHeader = decodeHeader(payload.slice(offset, offset + 80))
  offset += 80

  // Merged mining block header
  if ((merkleblock.blockHeader.version & BLOCK_VERSION_AUXPOW_BIT) !== 0) {
    // Version parent block
    offset += 4

    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    // tx_in
    for (let j = 0; j < compactSize.size; j++) {
      offset += 36

      const compactSizeTxIn = CompactSize.fromBuffer(payload, offset)
      offset += compactSizeTxIn.offset + compactSizeTxIn.size + 4
    }

    // tx_out
    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset

    for (let j = 0; j < compactSize.size; j++) {
      offset += 8

      const compactSizeTxOut = CompactSize.fromBuffer(payload, offset)
      offset += compactSizeTxOut.offset + compactSizeTxOut.size
    }

    // locktime + hash
    offset += 4 + 32

    // Coinbase Branch : Merkle branch
    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset + compactSize.size * 32

    // branch side mask
    offset += 4

    // Blockchain Branch : Merkle branch
    compactSize = CompactSize.fromBuffer(payload, offset)
    offset += compactSize.offset + compactSize.size * 32

    // branch side mask
    offset += 4

    // parentblock header
    offset += 80
  }

  merkleblock.transactionCount = payload.readUInt32LE(offset)
  offset += 4

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  merkleblock.hashCount = compactSize.size

  merkleblock.hashes = []
  for (let i = 0; i < merkleblock.hashCount; i++) {
    const hash = payload.slice(offset, offset + 32)
    offset += 32

    merkleblock.hashes.push(hash)
  }

  compactSize = CompactSize.fromBuffer(payload, offset)
  offset += compactSize.offset

  merkleblock.flagBytes = compactSize.size
  merkleblock.flags = payload.slice(offset, offset + merkleblock.flagBytes)

  return merkleblock
}

module.exports = { decodeMerkleblockMessage }
