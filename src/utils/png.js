const fs = require('fs');
const zlib = require('zlib');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const COLOR_TYPE_RGBA = 6;
const COLOR_TYPE_RGB = 2;
const COLOR_TYPE_INDEXED = 3;

function buildCrcTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) {
            c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        }
        table[i] = c >>> 0;
    }
    return table;
}

const CRC_TABLE = buildCrcTable();

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i += 1) {
        crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
}

function unfilterData(data, width, height, bpp) {
    const rowLength = width * bpp;
    const output = Buffer.alloc(height * rowLength);
    let inOffset = 0;
    for (let y = 0; y < height; y += 1) {
        const filterType = data[inOffset];
        inOffset += 1;
        const rowStart = y * rowLength;
        for (let x = 0; x < rowLength; x += 1) {
            const left = x >= bpp ? output[rowStart + x - bpp] : 0;
            const up = y > 0 ? output[rowStart - rowLength + x] : 0;
            const upLeft = y > 0 && x >= bpp ? output[rowStart - rowLength + x - bpp] : 0;
            const raw = data[inOffset + x];
            let val = 0;
            switch (filterType) {
                case 0:
                    val = raw;
                    break;
                case 1:
                    val = (raw + left) & 0xff;
                    break;
                case 2:
                    val = (raw + up) & 0xff;
                    break;
                case 3:
                    val = (raw + Math.floor((left + up) / 2)) & 0xff;
                    break;
                case 4:
                    val = (raw + paethPredictor(left, up, upLeft)) & 0xff;
                    break;
                default:
                    return null;
            }
            output[rowStart + x] = val;
        }
        inOffset += rowLength;
    }
    return output;
}

function readPng(input) {
    const buffer = Buffer.isBuffer(input) ? input : fs.readFileSync(input);
    if (buffer.length < PNG_SIGNATURE.length) return null;
    if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) return null;

    let width = null;
    let height = null;
    let bitDepth = null;
    let colorType = null;
    let interlace = 0;
    const idatChunks = [];
    let palette = null;
    let transparency = null;

    let offset = PNG_SIGNATURE.length;
    while (offset + 8 <= buffer.length) {
        const length = buffer.readUInt32BE(offset);
        offset += 4;
        const type = buffer.toString('ascii', offset, offset + 4);
        offset += 4;
        const data = buffer.subarray(offset, offset + length);
        offset += length + 4;

        if (type === 'IHDR') {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            bitDepth = data[8];
            colorType = data[9];
            interlace = data[12];
        } else if (type === 'IDAT') {
            idatChunks.push(data);
        } else if (type === 'PLTE') {
            palette = data;
        } else if (type === 'tRNS') {
            transparency = data;
        } else if (type === 'IEND') {
            break;
        }
    }

    if (!width || !height) return null;
    if (bitDepth !== 8) return null;
    if (interlace !== 0) return null;
    if (
        colorType !== COLOR_TYPE_RGBA &&
        colorType !== COLOR_TYPE_RGB &&
        colorType !== COLOR_TYPE_INDEXED
    ) {
        return null;
    }

    const compressed = Buffer.concat(idatChunks);
    const inflated = zlib.inflateSync(compressed);
    const bpp = colorType === COLOR_TYPE_RGBA ? 4 : colorType === COLOR_TYPE_RGB ? 3 : 1;
    const raw = unfilterData(inflated, width, height, bpp);
    if (!raw) return null;

    if (colorType === COLOR_TYPE_RGBA) {
        return { width, height, data: raw };
    }

    const rgba = Buffer.alloc(width * height * 4);
    if (colorType === COLOR_TYPE_RGB) {
        for (let i = 0, j = 0; i < raw.length; i += 3, j += 4) {
            rgba[j] = raw[i];
            rgba[j + 1] = raw[i + 1];
            rgba[j + 2] = raw[i + 2];
            rgba[j + 3] = 255;
        }
        return { width, height, data: rgba };
    }

    if (!palette) return null;
    const paletteEntries = Math.floor(palette.length / 3);
    for (let i = 0, j = 0; i < raw.length; i += 1, j += 4) {
        const idx = raw[i];
        if (idx >= paletteEntries) {
            rgba[j] = 0;
            rgba[j + 1] = 0;
            rgba[j + 2] = 0;
            rgba[j + 3] = 0;
            continue;
        }
        const palOffset = idx * 3;
        rgba[j] = palette[palOffset];
        rgba[j + 1] = palette[palOffset + 1];
        rgba[j + 2] = palette[palOffset + 2];
        rgba[j + 3] = transparency && idx < transparency.length ? transparency[idx] : 255;
    }
    return { width, height, data: rgba };
}

function writePng({ width, height, data }) {
    const rowLength = width * 4;
    const raw = Buffer.alloc((rowLength + 1) * height);
    for (let y = 0; y < height; y += 1) {
        const rowOffset = y * (rowLength + 1);
        raw[rowOffset] = 0;
        data.copy(raw, rowOffset + 1, y * rowLength, y * rowLength + rowLength);
    }
    const compressed = zlib.deflateSync(raw);

    const chunks = [];

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = COLOR_TYPE_RGBA;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;
    chunks.push(buildChunk('IHDR', ihdr));
    chunks.push(buildChunk('IDAT', compressed));
    chunks.push(buildChunk('IEND', Buffer.alloc(0)));

    return Buffer.concat([PNG_SIGNATURE, ...chunks]);
}

function buildChunk(type, data) {
    const typeBuf = Buffer.from(type, 'ascii');
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32BE(data.length, 0);
    const crcBuf = Buffer.alloc(4);
    const crcVal = crc32(Buffer.concat([typeBuf, data]));
    crcBuf.writeUInt32BE(crcVal, 0);
    return Buffer.concat([lengthBuf, typeBuf, data, crcBuf]);
}

function resizeNearest(image, width, height) {
    const { width: srcW, height: srcH, data } = image;
    if (srcW === width && srcH === height) return { width, height, data: Buffer.from(data) };
    const out = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
        const srcY = Math.min(srcH - 1, Math.floor((y / height) * srcH));
        for (let x = 0; x < width; x += 1) {
            const srcX = Math.min(srcW - 1, Math.floor((x / width) * srcW));
            const srcIdx = (srcY * srcW + srcX) * 4;
            const dstIdx = (y * width + x) * 4;
            out[dstIdx] = data[srcIdx];
            out[dstIdx + 1] = data[srcIdx + 1];
            out[dstIdx + 2] = data[srcIdx + 2];
            out[dstIdx + 3] = data[srcIdx + 3];
        }
    }
    return { width, height, data: out };
}

function drawImage(base, overlay, x, y) {
    const { width: baseW, height: baseH, data: baseData } = base;
    const { width: ovW, height: ovH, data: ovData } = overlay;
    for (let oy = 0; oy < ovH; oy += 1) {
        const by = y + oy;
        if (by < 0 || by >= baseH) continue;
        for (let ox = 0; ox < ovW; ox += 1) {
            const bx = x + ox;
            if (bx < 0 || bx >= baseW) continue;
            const oIdx = (oy * ovW + ox) * 4;
            const bIdx = (by * baseW + bx) * 4;
            const oa = ovData[oIdx + 3] / 255;
            if (oa <= 0) continue;
            const invA = 1 - oa;
            baseData[bIdx] = Math.round(ovData[oIdx] * oa + baseData[bIdx] * invA);
            baseData[bIdx + 1] = Math.round(ovData[oIdx + 1] * oa + baseData[bIdx + 1] * invA);
            baseData[bIdx + 2] = Math.round(ovData[oIdx + 2] * oa + baseData[bIdx + 2] * invA);
            baseData[bIdx + 3] = Math.round(ovData[oIdx + 3] + baseData[bIdx + 3] * invA);
        }
    }
}

module.exports = {
    readPng,
    writePng,
    resizeNearest,
    drawImage,
};