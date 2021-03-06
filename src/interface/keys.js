const KEYS = {
  UP: '\u001B\u005B\u0041',
  DOWN: '\u001B\u005B\u0042',
  CTRL_C: '\u0003',
  CTRL_V: '\u0016',
  NUM_KEY_0: '\u0030',
  NUM_KEY_1: '\u0031',
  NUM_KEY_2: '\u0032',
  NUM_KEY_3: '\u0033',
  NUM_KEY_4: '\u0034',
  NUM_KEY_5: '\u0035',
  ENTER: '\u000D',
  RETURN: process.platform === 'win32' ? '\u0008' : '\u007F'
}

module.exports = KEYS
