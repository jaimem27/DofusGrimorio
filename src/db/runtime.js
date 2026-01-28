const { createPool } = require('mysql2/promise');
const { runMigrations } = require('./migrate.js');
const cfg = require('./config.js');

function createMemoryConfigStore() {
    const store = new Map();

    return {
        async get(key) {
            return store.has(key) ? store.get(key) : null;
        },
        async getMany(keys) {
            const map = {};
            for (const key of keys) {
                if (store.has(key)) map[key] = store.get(key);
            }
            return map;
        },
        async set(key, value) {
            store.set(key, String(value));
        },
        async setMany(kv) {
            for (const [key, value] of Object.entries(kv)) {
                store.set(key, String(value));
            }
        },
        async del(key) {
            store.delete(key);
        },
        async delPrefix(prefix) {
            for (const key of Array.from(store.keys())) {
                if (key.startsWith(prefix)) store.delete(key);
            }
        },
    };
}

function createRuntimeDb() {
    const memoryConfig = createMemoryConfigStore();
    let configImpl = memoryConfig;
    let pool = null;

    const config = {
        get: (key) => configImpl.get(key),
        getMany: (keys) => configImpl.getMany(keys),
        set: (key, value) => configImpl.set(key, value),
        setMany: (kv) => configImpl.setMany(kv),
        del: (key) => configImpl.del(key),
        delPrefix: (prefix) => configImpl.delPrefix(prefix),
    };

    return {
        config,
        isPersistent() {
            return Boolean(pool);
        },
        async useMysqlConfig({ host, port, user, password, database }) {
            pool = createPool({
                host,
                port: Number(port || 3306),
                user,
                password,
                database,
                waitForConnections: true,
                connectionLimit: 5,
                queueLimit: 0,
                enableKeepAlive: true,
            });

            await runMigrations(pool);

            configImpl = {
                get: (key) => cfg.getConfig(pool, key),
                getMany: (keys) => cfg.getConfigMany(pool, keys),
                set: (key, value) => cfg.setConfig(pool, key, value),
                setMany: (kv) => cfg.setConfigMany(pool, kv),
                del: (key) => cfg.delConfig(pool, key),
                delPrefix: (prefix) => cfg.delPrefix(pool, prefix),
            };
        },
        getPool() {
            return pool;
        },
    };
}

module.exports = { createRuntimeDb };
