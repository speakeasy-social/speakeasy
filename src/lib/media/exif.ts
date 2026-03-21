import piexif from 'piexifjs'

import {logger} from '#/logger'

/**
 * Strips EXIF metadata from a JPEG image blob.
 * Non-JPEG blobs are returned unchanged.
 * On failure, returns the original blob to avoid blocking uploads.
 */
export async function stripExifFromBlob(blob: Blob): Promise<Blob> {
  const isKnownNonJpeg =
    blob.type !== '' && blob.type !== 'image/jpeg' && blob.type !== 'image/jpg'

  if (isKnownNonJpeg) {
    return blob
  }

  try {
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // Verify JPEG magic bytes (FF D8)
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) {
      return blob
    }

    // Convert to binary string for piexifjs
    const binaryString = uint8ArrayToBinaryString(bytes)
    const stripped = piexif.remove(binaryString)
    const strippedBytes = binaryStringToUint8Array(stripped)

    return new Blob([strippedBytes], {type: blob.type || 'image/jpeg'})
  } catch (error) {
    logger.warn('Failed to strip EXIF from image, using original', {
      message: error instanceof Error ? error.message : String(error),
    })
    return blob
  }
}

function uint8ArrayToBinaryString(bytes: Uint8Array): string {
  let binaryString = ''
  // Process in chunks to avoid call stack limits with String.fromCharCode.apply
  const chunkSize = 8192
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binaryString += String.fromCharCode(...chunk)
  }
  return binaryString
}

function binaryStringToUint8Array(binaryString: string): Uint8Array {
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}
