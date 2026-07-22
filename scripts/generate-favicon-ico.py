"""Build favicon.ico from assets/favicon-16.png and assets/favicon-32.png."""
from pathlib import Path
import io
import struct

from PIL import Image

root = Path(__file__).resolve().parents[1]
images = [
    Image.open(root / 'assets/favicon-16.png').convert('RGBA'),
    Image.open(root / 'assets/favicon-32.png').convert('RGBA'),
]


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


png_data = [png_bytes(img) for img in images]
offset = 6 + 16 * len(png_data)
entries = []
for img, data in zip(images, png_data):
    w, h = img.size
    entries.append((w, h, len(data), offset))
    offset += len(data)

out = io.BytesIO()
out.write(struct.pack('<HHH', 0, 1, len(entries)))
for (w, h, size, off), data in zip(entries, png_data):
    out.write(struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, size, off))
for data in png_data:
    out.write(data)

(root / 'favicon.ico').write_bytes(out.getvalue())
print('wrote favicon.ico')
