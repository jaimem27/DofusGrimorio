const { createPool } = require('mysql2/promise');
const { runMigrations } = require('./migrate.js');
const { dbHintFromError } = require('./errorHints.js');
const cfg = require('./config');

//bootStrap();

function makePool({ host, port, user, password, database }) {
    const pool = createPool({
        host,
        port: Number(port || 3306),
        user,
        password,
        database,

        waitForConnections: true,
        connectionLimit: 10, // Si el server tiene muchos usuarios concurrentes, aumentar este valor + 200
        queueLimit: 0,        // 0 = sin limite de peticiones en cola
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
    });

    return pool;
}

let pools = null;

function initPools(env) {
    if (pools) return pools;

    pools = {
        auth: makePool({
            host: env.DB_AUTH_HOST,
            port: env.DB_AUTH_PORT,
            user: env.DB_AUTH_USER,
            password: env.DB_AUTH_PASSWORD,
            database: env.DB_AUTH_DATABASE,
        }),
        world: makePool({
            host: env.DB_WORLD_HOST,
            port: env.DB_WORLD_PORT,
            user: env.DB_WORLD_USER,
            password: env.DB_WORLD_PASSWORD,
            database: env.DB_WORLD_DATABASE,
        }),
        grim: makePool({
            host: env.DB_AUTH_HOST,
            port: env.DB_AUTH_PORT,
            user: env.DB_AUTH_USER,
            password: env.DB_AUTH_PASSWORD,
            database: env.DB_AUTH_DATABASE,
        }),
        config: {
            get: (key) => cfg.getConfig(pools.grim, key),
            getMany: (keys) => cfg.getConfigMany(pools.grim, keys),
            set: (key, value) => cfg.setConfig(pools.grim, key, value),
            setMany: (kv) => cfg.setConfigMany(pools.grim, kv),
            del: (key) => cfg.delConfig(pools.grim, key),
            delPrefix: (prefix) => cfg.delPrefix(pools.grim, prefix),
        }
    };

    return pools;
}

async function testPools(p) {
    await p.auth.query('SELECT 1');
    await p.world.query('SELECT 1');
    await p.grim.query('SELECT 1');
}

function requireKeys(env, keys) {
    const missing = keys.filter(k => !env[k] || String(env[k]).trim() === '');
    if (missing.length) {
        const err = new Error(`Faltan variables de BD: ${missing.join(', ')}`);
        err.code = 'DB_ENV_MISSING';
        throw err;
    }
}


function initDb(env) {
    requireKeys(env, [
        'DB_AUTH_HOST', 'DB_AUTH_PORT', 'DB_AUTH_USER', 'DB_AUTH_PASSWORD', 'DB_AUTH_DATABASE',
        'DB_WORLD_HOST', 'DB_WORLD_PORT', 'DB_WORLD_USER', 'DB_WORLD_PASSWORD', 'DB_WORLD_DATABASE',
    ]);

    const pools = initPools(env);

    return {
        pools,
        config: pools.config,
        async migrate() {
            await runMigrations(pools.grim);
        },
        async health() {
            const lines = [];

            try {
                await testPools(pools);
                lines.push('BD -> conectada');
                return { ok: true, lines };
            } catch (err) {
                const hint = dbHintFromError(err);
                lines.push('Error de conexión a la base de datos.');
                if (hint) lines.push(hint);
                return { ok: false, lines, err };
            }
        },
    };
}

module.exports = { initPools, testPools, initDb };