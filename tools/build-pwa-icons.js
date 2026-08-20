"use strict";

// Genera los iconos de la PWA a partir del logo real de Nextfor.
//
// Por que no un SVG dibujado a mano: iOS solo acepta PNG para el icono de la
// pantalla de inicio, y un logo redibujado "parecido" no es el logo. Este script
// decodifica admin-assets/nextfor-mark.png, lo escala y lo compone centrado
// sobre el navy de marca. Solo usa zlib, que viene con Node: sin dependencias
// nuevas y sin binarios que instalar en Render.
//
// Correr:  node tools/build-pwa-icons.js
// Salida:  admin-assets/pwa-icon-{192,512,maskable-512,apple-180}.png

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const BRAND_NAVY = [10, 24, 54];   // #0A1836, el fondo de marca
const SOURCE = path.join(__dirname, "..", "admin-assets", "nextfor-mark.png");
const OUT_DIR = path.join(__dirname, "..", "admin-assets");

// ─── Decodificar PNG ────────────────────────────────────────────────────────

function readChunks(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("no es un PNG");
  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buffer.slice(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  return chunks;
}

function decodePng(buffer) {
  const chunks = readChunks(buffer);
  const ihdr = chunks.find(function (chunk) { return chunk.type === "IHDR"; });
  if (!ihdr) throw new Error("PNG sin IHDR");

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (depth !== 8) throw new Error("solo soporto 8 bits por canal, no " + depth);
  if (interlace !== 0) throw new Error("no soporto PNG entrelazado");
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error("tipo de color no soportado: " + colorType);

  const idat = Buffer.concat(chunks.filter(function (c) { return c.type === "IDAT"; })
    .map(function (c) { return c.data; }));
  const raw = zlib.inflateSync(idat);

  // Deshacer los filtros por fila (spec PNG, seccion 9).
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[pos];
    pos += 1;
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[pos + x];
      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[prevStart + x] : 0;
      const upLeft = (y > 0 && x >= channels) ? pixels[prevStart + x - channels] : 0;
      let restored;
      if (filter === 0) restored = value;
      else if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + up;
      else if (filter === 3) restored = value + ((left + up) >> 1);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        restored = value + (pa <= pb && pa <= pc ? left : (pb <= pc ? up : upLeft));
      } else throw new Error("filtro PNG desconocido: " + filter);
      pixels[rowStart + x] = restored & 0xff;
    }
    pos += stride;
  }

  return { width, height, channels, pixels };
}

// ─── Componer y codificar ───────────────────────────────────────────────────

function samplePixel(image, x, y) {
  const index = (y * image.width + x) * image.channels;
  const p = image.pixels;
  if (image.channels >= 3) {
    return [p[index], p[index + 1], p[index + 2], image.channels === 4 ? p[index + 3] : 255];
  }
  const gray = p[index];
  return [gray, gray, gray, image.channels === 2 ? p[index + 1] : 255];
}

// El logo real viene sobre fondo blanco. Sobre navy quedaria un rectangulo
// blanco, asi que tratamos el blanco casi puro como transparente.
function isBackground(rgba) {
  return rgba[3] < 16 || (rgba[0] > 240 && rgba[1] > 240 && rgba[2] > 240);
}

function renderIcon(source, size, padRatio) {
  const canvas = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i += 1) {
    canvas[i * 3] = BRAND_NAVY[0];
    canvas[i * 3 + 1] = BRAND_NAVY[1];
    canvas[i * 3 + 2] = BRAND_NAVY[2];
  }

  // El logo es apaisado: se escala por el lado que primero toque el margen y
  // se centra, para no deformarlo.
  const inner = Math.round(size * (1 - padRatio * 2));
  const scale = Math.min(inner / source.width, inner / source.height);
  const drawWidth = Math.max(1, Math.round(source.width * scale));
  const drawHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.round((size - drawWidth) / 2);
  const offsetY = Math.round((size - drawHeight) / 2);

  for (let y = 0; y < drawHeight; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < drawWidth; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const rgba = samplePixel(source, sourceX, sourceY);
      if (isBackground(rgba)) continue;
      const target = ((offsetY + y) * size + (offsetX + x)) * 3;
      const alpha = rgba[3] / 255;
      canvas[target] = Math.round(rgba[0] * alpha + BRAND_NAVY[0] * (1 - alpha));
      canvas[target + 1] = Math.round(rgba[1] * alpha + BRAND_NAVY[1] * (1 - alpha));
      canvas[target + 2] = Math.round(rgba[2] * alpha + BRAND_NAVY[2] * (1 - alpha));
    }
  }
  return canvas;
}

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgb, size) {
  const stride = size * 3;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (stride + 1)] = 0;   // filtro None: los iconos son chicos
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // 8 bits por canal
  ihdr[9] = 2;    // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const source = decodePng(fs.readFileSync(SOURCE));
console.log("logo fuente: " + source.width + "x" + source.height + ", " + source.channels + " canales");

// Android recorta los iconos "maskable" a un circulo: el logo necesita mas
// margen ahi, o le come las puntas de las flechas.
const targets = [
  { file: "pwa-icon-192.png", size: 192, pad: 0.14 },
  { file: "pwa-icon-512.png", size: 512, pad: 0.14 },
  { file: "pwa-icon-maskable-512.png", size: 512, pad: 0.26 },
  { file: "pwa-icon-apple-180.png", size: 180, pad: 0.12 }
];

targets.forEach(function (target) {
  const png = encodePng(renderIcon(source, target.size, target.pad), target.size);
  fs.writeFileSync(path.join(OUT_DIR, target.file), png);
  console.log("  " + target.file + "  " + target.size + "x" + target.size + "  " + png.length + " bytes");
});

console.log("iconos listos.");
