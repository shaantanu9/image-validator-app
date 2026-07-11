// ---------------------------------------------------------------------------
// `await` is a yield point. Single-threaded does NOT mean atomic.
//
// Two SIMULTANEOUS upload requests carrying the same photo will each read the
// duplicate corpus before either has inserted its row — so both see an empty
// corpus and both are accepted. A green test suite says nothing about this,
// because every test uploads sequentially. It only shows up under `Promise.all`.
//
// The fix is to hold read-decide-insert under a lock. The lock is keyed BY OWNER:
// a global lock would queue every user's uploads behind strangers who share no
// state with them.
//
// KNOWN HOLE, worth naming before an interviewer does: this mutex is
// process-local, so two API instances still race. The fix is a distributed lease
// (Redis `SET NX PX`), scoped per user. It is one call site — this one.
// ---------------------------------------------------------------------------

class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  runExclusive<T>(task: () => Promise<T>): Promise<T> {
    // `.then(task, task)` passes task as BOTH handlers on purpose: if the previous
    // task rejected, the chain must still run the next one. With a single handler
    // one caller's failure would deadlock everybody queued behind it, forever.
    const result = this.tail.then(task, task);
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

export class KeyedMutex {
  private readonly locks = new Map<string, { mutex: Mutex; waiting: number }>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    let entry = this.locks.get(key);
    if (!entry) {
      entry = { mutex: new Mutex(), waiting: 0 };
      this.locks.set(key, entry);
    }

    // Evict by REFCOUNT, not by promise identity. The tempting alternative —
    // "delete the key if the stored promise is still the one I created" — never
    // fires once a second caller has replaced the tail, so the map grows by one
    // lock per user and never shrinks.
    entry.waiting += 1;
    try {
      return await entry.mutex.runExclusive(task);
    } finally {
      entry.waiting -= 1;
      if (entry.waiting === 0) this.locks.delete(key);
    }
  }

  /** Test seam: proves the map does not leak a lock per owner. */
  get size(): number {
    return this.locks.size;
  }
}

/** One lock instance for the upload decision path. */
export const decisionLock = new KeyedMutex();
