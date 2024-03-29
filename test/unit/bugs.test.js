const test = require('ava')
const fs = require('fs')
const path = require('path')

const { decodeMerkleblockMessage } = require('../../src/commands/merkleblock')
const { decodeHeadersMessage } = require('../../src/commands/headers')

/*
    Test file with bug found when running the software
*/

test('error decoding `merkleblock` payload', t => {
  const data = '02016200b7ac5cc3ca94d8b154661cba795fc4912f3b6ce83a3c5669053e7f677b360dab5433333435a7c5f5b0f02601d8108970360bc806ce28a50747a68090785c5dd5f698e05360d0051e0000000002000000010000000000000000000000000000000000000000000000000000000000000000ffffffff3d037827022cfabe6d6db4106f06d051743d737eb7a6dbefdc008940c62d3f5d6453551dd20d8e7fb6f0040000000000000001000000000000000000000000000000012e016af1b20000001976a9149628aabe802c3f6f67946f70c300321d7110bc4388ac00000000f0550a4183f7eabaaeaff72d876115573148c79b4972d34085c2b4de07a2608600000000000257a668057a41b9aa2c6d44c32e9141ac291a2587fbc9384eca0ebc743b696f235c6a0f13f6429bd555d08e4b17007468fd10d52250a0de605c927d745197ba3900000000020000007042a116c81e3cfb6a5681cde48703a895a3a6fba717317090111400aeccfb968b756e0cf7c1f5b638a1b2b804d7d022ee39fab0fef4e2e67f4e303a189990472499e053caee011c000eb60a01000000015433333435a7c5f5b0f02601d8108970360bc806ce28a50747a68090785c5dd50100'

  decodeMerkleblockMessage(Buffer.from(data, 'hex'))

  // SOLVED: it was fucking variable name scoping issue (don't be lazy find new name for your variable)

  t.pass()
})

test('error decoding `header` payload because of F00DB4B3 nonce', t => {
  const data = fs.readFileSync(path.join('test', 'test_vectors', 'foodbabeheader.raw'))

  decodeHeadersMessage(data)

  // SOLVED: We can detect if a block is AUXPOW usig the versio and bit mask

  t.pass()
})
