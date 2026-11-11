// Keeps one record in IndexedDB, the browser's built-in database. It lives on
// this device, in this browser, for this site only. Nothing here talks to a
// server.
//
// IndexedDB answers through events, not return values, so each call is
// wrapped in a Promise (a value that arrives later) to make it usable with
// "await". Every function can fail, for example in a private window where
// storage is switched off; callers must cope with that.

import { parseSaved, type SavedState } from './saved.ts'

const DB_NAME = 'skill-map'
const STORE = 'state'
const KEY = 'current'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    // Runs the first time, when the database does not exist yet.
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open browser storage'))
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode)
      const request = work(transaction.objectStore(STORE))
      // Wait for the whole transaction, so a write is really on disk before we say so.
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error ?? new Error('Browser storage failed'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Browser storage failed'))
    })
  } finally {
    db.close()
  }
}

/** What was saved last time, or null if nothing usable is there. */
export async function loadSaved(): Promise<SavedState | null> {
  return parseSaved(await run('readonly', (store) => store.get(KEY) as IDBRequest<unknown>))
}

export async function writeSaved(state: SavedState): Promise<void> {
  await run('readwrite', (store) => store.put(state, KEY))
}

export async function deleteSaved(): Promise<void> {
  await run('readwrite', (store) => store.delete(KEY))
}
