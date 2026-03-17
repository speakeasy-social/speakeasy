declare module 'piexifjs' {
  const piexif: {
    remove(jpeg: string): string
    load(data: string): Record<string, unknown>
    insert(exif: string, jpeg: string): string
    dump(exifObj: Record<string, unknown>): string
    version: string
    GPSIFD: Record<string, number>
    ImageIFD: Record<string, number>
    ExifIFD: Record<string, number>
    InteropIFD: Record<string, number>
  }
  export default piexif
}
