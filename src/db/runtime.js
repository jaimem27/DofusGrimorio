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

    let configPool = null;
    const pools = { auth: null, world: null };
    const poolConfigs = { auth: null, world: null };

    const AUTH_KEYS = ['auth.host', 'auth.port', 'auth.user', 'auth.password', 'auth.db'];
    const WORLD_KEYS = ['world.host', 'world.port', 'world.user', 'world.password', 'world.db'];
    const REQUIRED_KEYS = {
        auth: ['auth.host', 'auth.port', 'auth.user', 'auth.db'],
        world: ['world.host', 'world.port', 'world.user', 'world.db'],
    };

    function normalizeConfigValue(value) {
        return String(value ?? '').trim();
    }

    function buildPool(config) {
        return createPool({
            host: config.host,
            port: Number(config.port || 3306),
            user: config.user,
            password: config.password,
            database: config.database,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
    }

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
            return Boolean(configPool);
        },
        async useMysqlConfig({ host, port, user, password, database, migrate = true }) {
            configPool = createPool({
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

            if (migrate) {
                await runMigrations(configPool);
            }

            configImpl = {
                get: (key) => cfg.getConfig(configPool, key),
                getMany: (keys) => cfg.getConfigMany(configPool, keys),
                set: (key, value) => cfg.setConfig(configPool, key, value),
                setMany: (kv) => cfg.setConfigMany(configPool, kv),
                del: (key) => cfg.delConfig(configPool, key),
                delPrefix: (prefix) => cfg.delPrefix(configPool, prefix),
            };
        },
        async getPool(kind = 'config') {
            if (kind === 'config') {
                return configPool;
            }

            if (!pools[kind]) {
                pools[kind] = null;
            }

            const keys = kind === 'auth' ? AUTH_KEYS : WORLD_KEYS;
            const cfgValues = await config.getMany(keys);
            const missing = REQUIRED_KEYS[kind].filter(
                (key) => !normalizeConfigValue(cfgValues[key])
            );

            if (missing.length) return null;

            const nextConfig = {
                host: normalizeConfigValue(cfgValues[`${kind}.host`]),
                port: normalizeConfigValue(cfgValues[`${kind}.port`]),
                user: normalizeConfigValue(cfgValues[`${kind}.user`]),
                password: cfgValues[`${kind}.password`] ?? '',
                database: normalizeConfigValue(cfgValues[`${kind}.db`]),
            };

            const previous = poolConfigs[kind];
            const isSame = previous && Object.keys(nextConfig).every(
                key => previous[key] === nextConfig[key]
            );

            if (pools[kind] && isSame) return pools[kind];

            if (pools[kind]) {
                try {
                    await pools[kind].end();
                } catch (_) { }
            }

            pools[kind] = buildPool(nextConfig);
            poolConfigs[kind] = nextConfig;
            return pools[kind];
        },
    };
}

module.exports = { createRuntimeDb };
