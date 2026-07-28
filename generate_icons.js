const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Standard CRC32 implementation
const crcTable = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
}

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function makePng(width, height, drawFn) {
    const rowSize = 1 + width * 4;
    const rawData = Buffer.alloc(height * rowSize);

    for (let y = 0; y < height; y++) {
        const rowOffset = y * rowSize;
        rawData[rowOffset] = 0; // Filter type 0 (None)
        for (let x = 0; x < width; x++) {
            const pixelOffset = rowOffset + 1 + x * 4;
            
            // 4x4 Supersampling for buttery smooth anti-aliasing
            let rTotal = 0, gTotal = 0, bTotal = 0, aTotal = 0;
            const subSamples = 4;
            for (let sy = 0; sy < subSamples; sy++) {
                for (let sx = 0; sx < subSamples; sx++) {
                    const fx = (x + (sx + 0.5) / subSamples) / width;
                    const fy = (y + (sy + 0.5) / subSamples) / height;
                    const c = drawFn(fx, fy);
                    rTotal += c[0];
                    gTotal += c[1];
                    bTotal += c[2];
                    aTotal += c[3];
                }
            }
            const count = subSamples * subSamples;
            rawData[pixelOffset] = Math.round(rTotal / count);
            rawData[pixelOffset + 1] = Math.round(gTotal / count);
            rawData[pixelOffset + 2] = Math.round(bTotal / count);
            rawData[pixelOffset + 3] = Math.round(aTotal / count);
        }
    }

    const compressed = zlib.deflateSync(rawData);
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    function createChunk(type, data) {
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(data.length, 0);
        const typeBuf = Buffer.from(type, 'ascii');
        const payload = Buffer.concat([typeBuf, data]);
        const crcVal = crc32(payload);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crcVal, 0);
        return Buffer.concat([lenBuf, payload, crcBuf]);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const ihdrChunk = createChunk('IHDR', ihdr);
    const idatChunk = createChunk('IDAT', compressed);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance to rounded rectangle centered at 0,0 with half-width hw, half-height hh, radius r
function sdRoundedRect(u, v, hw, hh, r) {
    const dx = Math.abs(u) - hw + r;
    const dy = Math.abs(v) - hh + r;
    const maxDX = Math.max(dx, 0);
    const maxDY = Math.max(dy, 0);
    const inside = Math.min(Math.max(dx, dy), 0);
    return Math.sqrt(maxDX * maxDX + maxDY * maxDY) + inside - r;
}

// Draw a dynamic 45-degree angled dumbbell with shadow & gradient
function renderDumbbellIcon(fx, fy) {
    // Rich dark slate radial-linear background (#1E293B -> #0F172A)
    const bgDist = Math.hypot(fx - 0.3, fy - 0.3);
    const tBg = Math.min(1, bgDist * 1.2);
    const rBg = 30 * (1 - tBg) + 15 * tBg;
    const gBg = 41 * (1 - tBg) + 23 * tBg;
    const bBg = 59 * (1 - tBg) + 42 * tBg;
    let color = [rBg, gBg, bBg, 255];

    // Rotate coordinates by 45 degrees for a dynamic diagonal dumbbell
    const angle = -Math.PI / 4;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Helper to evaluate dumbbell shape distance
    function dumbbellSDF(ux, vy) {
        const u = ux * cosA + vy * sinA;
        const v = -ux * sinA + vy * cosA;

        // 1. Bar handle in center
        const dBar = sdRoundedRect(u, v, 0.20, 0.038, 0.015);

        // 2. Lock collars
        const dCollarLeft = sdRoundedRect(u + 0.21, v, 0.012, 0.058, 0.005);
        const dCollarRight = sdRoundedRect(u - 0.21, v, 0.012, 0.058, 0.005);
        const dCollars = Math.min(dCollarLeft, dCollarRight);

        // 3. Inner weight plates
        const dInnerLeft = sdRoundedRect(u + 0.245, v, 0.022, 0.15, 0.018);
        const dInnerRight = sdRoundedRect(u - 0.245, v, 0.022, 0.15, 0.018);
        const dInner = Math.min(dInnerLeft, dInnerRight);

        // 4. Outer weight plates (larger)
        const dOuterLeft = sdRoundedRect(u + 0.305, v, 0.032, 0.21, 0.025);
        const dOuterRight = sdRoundedRect(u - 0.305, v, 0.032, 0.21, 0.025);
        const dOuter = Math.min(dOuterLeft, dOuterRight);

        return {
            minDist: Math.min(dBar, dCollars, dInner, dOuter),
            dBar,
            dCollars,
            dInner,
            dOuter,
            u,
            v
        };
    }

    // Check shadow (shifted down and right by 0.04)
    const shadowRes = dumbbellSDF(fx - 0.5 - 0.03, fy - 0.5 - 0.04);
    if (shadowRes.minDist < 0.05) {
        const shadowAlpha = Math.max(0, 1 - shadowRes.minDist / 0.05) * 0.45;
        color[0] = color[0] * (1 - shadowAlpha);
        color[1] = color[1] * (1 - shadowAlpha);
        color[2] = color[2] * (1 - shadowAlpha);
    }

    // Evaluate dumbbell shape at current pixel
    const res = dumbbellSDF(fx - 0.5, fy - 0.5);

    if (res.minDist <= 0) {
        // We are inside the dumbbell! Determine which part we hit:
        const { dBar, dCollars, dInner, dOuter, u, v } = res;

        // Metallic handle & collars
        if (dBar <= 0 || dCollars <= 0) {
            // Metallic silver gradient with cylindrical highlight
            const cyl = 1 - Math.min(1, Math.abs(v) / 0.06);
            const light = 120 + 110 * cyl;
            color = [light, light + 5, light + 15, 255];
        }

        // Weight plates (Vibrant emerald/mint gradient with 3D bevel sheen)
        if (dInner <= 0 || dOuter <= 0) {
            // Gradient along the diagonal and vertical
            const sheen = Math.min(1, Math.max(0, 0.6 - v * 2));
            const rPlate = Math.round(16 + 30 * sheen);
            const gPlate = Math.round(150 + 65 * sheen);
            const bPlate = Math.round(105 + 45 * sheen);
            color = [rPlate, gPlate, bPlate, 255];
        }
    }

    return color;
}

const png192 = makePng(192, 192, renderDumbbellIcon);
const png512 = makePng(512, 512, renderDumbbellIcon);

const srcDir = path.join(__dirname, 'src');
fs.writeFileSync(path.join(srcDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(srcDir, 'icon-512.png'), png512);

console.log('Beautiful realistic dumbbell PNG icons generated: icon-192.png, icon-512.png');
