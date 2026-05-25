const blobUrls = new Set<string>()

export function createManagedBlobUrl(blob: Blob): string {
  const url = URL.createObjectURL(blob)
  blobUrls.add(url)
  return url
}

export function revokeManagedBlobUrl(url: string): void {
  if (blobUrls.has(url)) {
    URL.revokeObjectURL(url)
    blobUrls.delete(url)
  }
}

export function revokeAllManagedBlobUrls(): void {
  for (const url of blobUrls) {
    URL.revokeObjectURL(url)
  }
  blobUrls.clear()
}
