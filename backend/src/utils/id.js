const crypto = require('crypto');

let counter = crypto.randomBytes(3).readUIntBE(0, 3);
const MACHINE = crypto.randomBytes(5);

/**
 * 24-char hex id, ObjectId-shaped: 4-byte timestamp + 5 random + 3 counter.
 * Keeps ids sortable by creation time and compatible with the CHAR(24) columns.
 */
function newId() {
  const buf = Buffer.alloc(12);
  buf.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  MACHINE.copy(buf, 4);
  counter = (counter + 1) % 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString('hex');
}

const isId = (v) => typeof v === 'string' && /^[0-9a-f]{24}$/i.test(v);

module.exports = { newId, isId };
