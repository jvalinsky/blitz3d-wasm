export interface SaveMetadata {
  id: string;
  timestamp: number;
}

class SaveSystem {
  private db: IDBDatabase | null = null;
  private readonly dbName = "Blitz3DSaves";
  private readonly storeName = "saves";

  async init(): Promise<void> {
    if (typeof indexedDB === "undefined") return;
    return new Promise((resolve) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this.storeName);
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      request.onerror = () => {
        console.warn("Failed to initialize IndexedDB for saves");
        resolve();
      };
    });
  }

  async listSaves(): Promise<SaveMetadata[]> {
    if (!this.db) return [];
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const request = store.getAllKeys();
        request.onsuccess = () => {
          const keys = request.result as string[];
          resolve(keys.map((id) => ({ id, timestamp: Date.now() })));
        };
        request.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async loadSave(id: string): Promise<Uint8Array | null> {
    if (!this.db) return null;
    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(this.storeName, "readonly");
        const store = tx.objectStore(this.storeName);
        const request = store.get(id);
        request.onsuccess = () => {
          resolve(request.result as Uint8Array | null);
        };
        request.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  async writeSave(id: string, data: Uint8Array): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(this.storeName, "readwrite");
        const store = tx.objectStore(this.storeName);
        const request = store.put(data, id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(new Error("Failed to write save"));
      } catch (e) {
        reject(e);
      }
    });
  }

  isSavePath(path: string): boolean {
    return path.toLowerCase().startsWith("saves/") &&
      path.toLowerCase().endsWith("/save.txt");
  }

  getSlotFromPath(path: string): string | null {
    const match = path.match(/saves\/([^/]+)\/save\.txt/i);
    return match ? match[1] : null;
  }
}

const saveSystemInstance = new SaveSystem();

export function getSaveSystem() {
  return saveSystemInstance;
}
