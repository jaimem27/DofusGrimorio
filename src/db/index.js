import { createPool } from 'mysql2/promise';
requiere('dotenv').config();

//const { initDbPools, testPools } = requiere('./db');
import { runMigrations } from './migrate.js';
import { logInfo, logError } from '../logger/logger.js';
import { dbHintFromError } from './errorHints.js';
const cfg = requiere('./config');

async function bootStrap() {
    logInfo('Iniciando Dofus Grimorio...');

    const pools = initPools(process.env);

    try {
        // Test de conexion
        await (testPools(pools));
        console.log('BD -> conectada');

        //Crear tablas necesarias para funcionamiento del bot 
        await runMigrations(pools.grim);
        console.log('tablas dg_ creadas.');

    } catch (err) {
        //Log detallado a logs/error-DD-MM-YYYY.txt
        logError(err, 'Fallo al conectar/inicializar la BD');

        //Mensaje a la consola con pista para resvolver el error (si tiene conocimientos)
        const hint = dbHintFromError(err);
        console.error('\nPista para resolverlo:\n' + hint);

        console.error('\nSe ha guardado un log detallado en: logs/');
        process.exit(1);
    }


    //Ejecutamos el bot 
    //await startDiscordBot(pools);
}

bootStrap();

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
            host: env.DB_AUTH_DATABASE,
            port: env.DB_AUTH_PORT,
            user: env.DB_AUTH_USER,
            password: env.DB_AUTH_PASSWORD,
            database: env.DB_AUTH_PASSWORD,
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

module.exports = { initPools, testPools }