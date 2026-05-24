const DB_NAME = 'react-video-editor-media'
const DB_VERSION = 1
const STORE_NAME = 'assets'

type MediaAssetRecord = {
  id: string
  blob: Blob
  name: string
  type: string
  originalPath?: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function runRequest<T = unknown>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveMediaAsset(file: File, id: string): Promise<{ mediaStorageKey: string; originalPath?: string }> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const originalPath = getFilePath(file)
  const record: MediaAssetRecord = {
    id,
    blob: file,
    name: file.name,
    type: file.type,
    originalPath,
  }
  await runRequest(store.put(record))
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
  return { mediaStorageKey: id, originalPath }
}

export async function loadMediaAssetUrl(id: string): Promise<string | null> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const record = await runRequest<MediaAssetRecord | undefined>(store.get(id))
  db.close()
  if (!record) return null
  return URL.createObjectURL(record.blob)
}

export async function deleteMediaAsset(id: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  await runRequest(store.delete(id))
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
  db.close()
}

function getFilePath(file: File): string | undefined {
  const maybePath = (file as File & { path?: string }).path
  if (maybePath && typeof maybePath === 'string') return maybePath
  return undefined
}
