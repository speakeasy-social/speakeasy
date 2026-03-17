import {describe, expect, it} from '@jest/globals'
import piexif from 'piexifjs'

import {stripExifFromBlob} from '../exif'

/**
 * Creates a minimal valid JPEG with EXIF data containing GPS coordinates.
 * Uses piexifjs to insert EXIF into a minimal JPEG.
 */
function createJpegWithExif(): Blob {
  // Minimal valid JPEG (1x1 white pixel)
  // SOI + APP0 (JFIF) + DQT + SOF0 + DHT + SOS + image data + EOI
  const minimalJpeg =
    '\xff\xd8' + // SOI
    '\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00' + // APP0
    '\xff\xdb\x00\x43\x00' + // DQT marker
    '\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09\x08\x0a\x0c\x14\x0d\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c\x20\x24\x2e\x27\x20\x22\x2c\x23\x1c\x1c\x28\x37\x29\x2c\x30\x31\x34\x34\x34\x1f\x27\x39\x3d\x38\x32\x3c\x2e\x33\x34\x32' + // quantization table
    '\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00' + // SOF0 (1x1 grayscale)
    '\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b' + // DHT
    '\xff\xda\x00\x08\x01\x01\x00\x00\x3f\x00\x7b\x40' + // SOS + minimal scan data
    '\xff\xd9' // EOI

  // Build EXIF with GPS data
  const exifObj: Record<string, Record<number, unknown>> = {
    '0th': {},
    Exif: {},
    GPS: {
      [piexif.GPSIFD.GPSLatitudeRef]: 'N',
      [piexif.GPSIFD.GPSLatitude]: [
        [40, 1],
        [44, 1],
        [0, 1],
      ],
      [piexif.GPSIFD.GPSLongitudeRef]: 'W',
      [piexif.GPSIFD.GPSLongitude]: [
        [73, 1],
        [59, 1],
        [0, 1],
      ],
    },
    Interop: {},
    '1st': {},
  }

  const exifBytes = piexif.dump(exifObj as Record<string, unknown>)
  const jpegWithExif = piexif.insert(exifBytes, minimalJpeg)

  // Convert binary string to Uint8Array
  const bytes = new Uint8Array(jpegWithExif.length)
  for (let i = 0; i < jpegWithExif.length; i++) {
    bytes[i] = jpegWithExif.charCodeAt(i)
  }

  return new Blob([bytes], {type: 'image/jpeg'})
}

/**
 * Check if a binary string contains an EXIF APP1 segment.
 */
function hasExifSegment(binaryString: string): boolean {
  // Look for FF E1 marker followed by "Exif\0\0"
  for (let i = 0; i < binaryString.length - 10; i++) {
    if (
      binaryString.charCodeAt(i) === 0xff &&
      binaryString.charCodeAt(i + 1) === 0xe1
    ) {
      const segment = binaryString.slice(i + 4, i + 10)
      if (segment === 'Exif\x00\x00') {
        return true
      }
    }
  }
  return false
}

async function blobToBinaryString(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  let binaryString = ''
  for (let i = 0; i < bytes.length; i++) {
    binaryString += String.fromCharCode(bytes[i])
  }
  return binaryString
}

describe('stripExifFromBlob', () => {
  it('strips EXIF data from a JPEG blob', async () => {
    const jpegWithExif = createJpegWithExif()
    const originalBinary = await blobToBinaryString(jpegWithExif)
    expect(hasExifSegment(originalBinary)).toBe(true)

    const stripped = await stripExifFromBlob(jpegWithExif)
    const strippedBinary = await blobToBinaryString(stripped)
    expect(hasExifSegment(strippedBinary)).toBe(false)

    // Verify it's still a valid JPEG (starts with FF D8)
    expect(strippedBinary.charCodeAt(0)).toBe(0xff)
    expect(strippedBinary.charCodeAt(1)).toBe(0xd8)
  })

  it('returns non-JPEG blobs unchanged', async () => {
    const pngBlob = new Blob(['not-a-jpeg'], {type: 'image/png'})
    const result = await stripExifFromBlob(pngBlob)
    expect(result).toBe(pngBlob)
  })

  it('returns blob unchanged when JPEG magic bytes are missing', async () => {
    // Has JPEG MIME type but wrong magic bytes
    const fakeJpeg = new Blob([new Uint8Array([0x00, 0x00, 0x00])], {
      type: 'image/jpeg',
    })
    const result = await stripExifFromBlob(fakeJpeg)
    expect(result).toBe(fakeJpeg)
  })

  it('preserves MIME type on the returned blob', async () => {
    const jpegWithExif = createJpegWithExif()
    const stripped = await stripExifFromBlob(jpegWithExif)
    expect(stripped.type).toBe('image/jpeg')
  })

  it('checks magic bytes for blobs with empty MIME type', async () => {
    const jpegWithExif = createJpegWithExif()
    // Re-create with empty MIME type
    const arrayBuffer = await jpegWithExif.arrayBuffer()
    const noMimeBlob = new Blob([arrayBuffer], {type: ''})

    const stripped = await stripExifFromBlob(noMimeBlob)
    const strippedBinary = await blobToBinaryString(stripped)
    expect(hasExifSegment(strippedBinary)).toBe(false)
  })
})
