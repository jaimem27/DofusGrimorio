class TTLCache {
    constructor() {
        this.map = new Map(); // key -> {value, expiryAt}
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return null;
        if (Date.now() > entry.expiryAt) {
            this.map.delete(key);
            return null;
        }
        return entry.value;
    }

    set(key, value, ttlMs) {
        this.map.set(key, { value, expiryAt: Date.now() + ttlMs });
    }

    del(key) {
        this.map.delete(key);
    }

}

class SingleFlight {
    constructor() {
        this.inFligth = new Map(); // key -> Promise
    }

    async do(key, fn) {
        if (this.inFligth.has(key)) return this.inFligth.get(key);

        const p = (async () => {
            try {
                return await fn();
            } finally {
                this.inFligth.delete(key);
            }
        })();

        this.inFligth.set(key, p);
        return p;
    }
}

const cache = new TTLCache();
const singleFlight = new SingleFlight();

module.exports = { cache, singleFlight };

