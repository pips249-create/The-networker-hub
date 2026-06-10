/** Read pixel dimensions from common image buffers (no native deps). */
const MAX_FETCH_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 8000;

function imageDimensionsFromBuffer(buffer) {
  if (!buffer || buffer.length < 24) return null;

  // PNG — IHDR at bytes 16–23
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
    };
  }

  // GIF
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return {
      width: buffer.readUInt16LE(6),
      height: buffer.readUInt16LE(8),
    };
  }

  // WebP (RIFF)
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return {
        width: 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16)),
        height: 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16)),
      };
    }
    if (chunk === 'VP8 ' && buffer.length >= 30) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === 'VP8L' && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >> 14) & 0x3fff) + 1,
      };
    }
  }

  // JPEG — scan for SOF markers
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      const len = buffer.readUInt16BE(offset + 2);
      if (len < 2) break;
      offset += 2 + len;
    }
  }

  return null;
}

async function fetchImageBufferFromUrl(url) {
  const controller = new AbortController();
  const timeout = setTimeout(function () {
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'image/*,*/*;q=0.8' },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = String(res.headers.get('content-type') || '').toLowerCase();
    if (contentType && !contentType.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return null;
    return buf.length > MAX_FETCH_BYTES ? buf.subarray(0, MAX_FETCH_BYTES) : buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function imageDimensionsFromUrl(url) {
  const src = String(url || '').trim();
  if (!/^https?:\/\//i.test(src)) return null;
  const buffer = await fetchImageBufferFromUrl(src);
  if (!buffer) return null;
  return imageDimensionsFromBuffer(buffer);
}

module.exports = {
  imageDimensionsFromBuffer,
  imageDimensionsFromUrl,
};
