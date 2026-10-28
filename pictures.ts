/* The pictures a user uploads to place on their clips, kept in this browser's IndexedDB between visits: they are too
   big for the kit in local storage. Storage can be blocked or missing, as in a private window, so every call fails
   quietly and the pictures simply aren't kept. */

const DATABASE = "soundbite";
const STORE = "pictures";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const done = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onerror = () => reject(transaction.error);
  transaction.onabort = () => reject(transaction.error);
});

/** Every kept picture by key; empty when none are kept or storage can't be read. */
export async function loadPictures(): Promise<Record<string, Blob>> {
  try {
    const database = await open();
    const transaction = database.transaction(STORE, "readonly");
    const store = transaction.objectStore(STORE);
    const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const values = await new Promise<unknown[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return Object.fromEntries(keys.map((key, index) => [String(key), values[index]]).filter((entry): entry is [string, Blob] => entry[1] instanceof Blob));
  } catch {
    return {};
  }
}

/** Keeps exactly these pictures: new ones are stored, ones no longer listed are let go. */
export async function savePictures(pictures: Record<string, Blob | string>): Promise<void> {
  try {
    const database = await open();
    const transaction = database.transaction(STORE, "readwrite");
    const store = transaction.objectStore(STORE);
    const request = store.getAllKeys();
    request.onsuccess = () => {
      const kept = new Set(request.result.map(String));
      for (const key of kept) if (!(key in pictures)) store.delete(key);
      for (const [key, picture] of Object.entries(pictures)) if (picture instanceof Blob && !kept.has(key)) store.put(picture, key);
    };
    await done(transaction);
    database.close();
  } catch {
    // Not kept this time; the clip itself is unaffected.
  }
}
