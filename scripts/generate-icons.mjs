import { deflateSync } from 'node:zlib';
import { writeFile, mkdir } from 'node:fs/promises';

function crc32(buf) {
  let table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([lenBuf, combined, crcBuf]);
}

function generateIconPng(size) {
  // Signature
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0); // width
  ihdrData.writeUInt32BE(size, 4); // height
  ihdrData.writeUInt8(8, 8);       // bit depth
  ihdrData.writeUInt8(6, 9);       // color type (RGBA)
  ihdrData.writeUInt8(0, 10);      // compression
  ihdrData.writeUInt8(0, 11);      // filter
  ihdrData.writeUInt8(0, 12);      // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw bitmap with scanline filter byte 0
  const scanlineWidth = 1 + size * 4;
  const rawData = Buffer.alloc(scanlineWidth * size);

  // Background: dark slate #1e1e2e, draw a stylised green Vim 'V' shape
  const bgR = 0x18, bgG = 0x18, bgB = 0x25, bgA = 0xff;
  const fgR = 0x00, fgG = 0xc8, fgB = 0x53, fgA = 0xff; // Vibrant Vim green

  for (let y = 0; y < size; y++) {
    const rowOffset = y * scanlineWidth;
    rawData[rowOffset] = 0; // Filter None

    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;

      // Normalized coordinates [0, 1]
      const nx = x / (size - 1);
      const ny = y / (size - 1);

      // Rounded rectangle background margin
      const cornerRadius = 0.22;
      const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - cornerRadius));
      const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - cornerRadius));
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > cornerRadius) {
        // Transparent outside rounded rect
        rawData[pxOffset + 0] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
        continue;
      }

      // Check if inside letter "V"
      // Left arm: from (0.24, 0.22) to (0.50, 0.78)
      // Right arm: from (0.76, 0.22) to (0.50, 0.78)
      const inV = (
        ny >= 0.22 && ny <= 0.78 &&
        (Math.abs(nx - (0.24 + (ny - 0.22) * (0.26 / 0.56))) < 0.09 ||
         Math.abs(nx - (0.76 - (ny - 0.22) * (0.26 / 0.56))) < 0.09)
      );

      if (inV) {
        rawData[pxOffset + 0] = fgR;
        rawData[pxOffset + 1] = fgG;
        rawData[pxOffset + 2] = fgB;
        rawData[pxOffset + 3] = fgA;
      } else {
        rawData[pxOffset + 0] = bgR;
        rawData[pxOffset + 1] = bgG;
        rawData[pxOffset + 2] = bgB;
        rawData[pxOffset + 3] = bgA;
      }
    }
  }

  const idatData = deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', idatData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
}

await mkdir('public/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const buf = generateIconPng(size);
  await writeFile(`public/icons/icon-${size}.png`, buf);
  console.log(`Generated public/icons/icon-${size}.png (${size}x${size}, ${buf.length} bytes)`);
}
