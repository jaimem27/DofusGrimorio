import { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } from 'discord.js';

const { buildInstallView, IDS } = require('./ui.js');
const { hintFromDbError } = require('../../db/errorHints.js');
const mysql2 = require('mysql2/promise');

const MODALS = {
    AUTH: 'dg:modal:auth',
    WORLD: 'dg:modal:world',
}

function isAdmin(interaction) {
    const perms = interaction.memberPermissions;
    if (!perms) return false;
    return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

const AUTH_KEYS = ['auth.host', 'auth.port', 'auth.user', 'auth.password', 'auth.db'];
const WORLD_KEYS = ['world.host', 'world.port', 'world.user', 'world.password', 'world.db'];

async function loadInstallState(db) {
    const cfg = await db.config.getMany([
        ...AUTH_KEYS,
        ...WORLD_KEYS,
        'install.done',
    ]);

    const authConfigured = AUTH_KEYS.every(k => (cfg[k] ?? '').toString().length > 0);
    const worldConfigured = WORLD_KEYS.every(k => (cfg[k] ?? '').toString().length > 0);
    const installed = (cfg['install.done'] ?? '0') === '1';

    return {
        authConfigured,
        worldConfigured,
        installed,
        tablesReady: true,
    };
}

function makeDbModal(kind, defaults = {}) {
    const isAuth = kind === 'auth';
    const modalId = isAuth ? MODALS.AUTH : MODALS.WORLD;

    const prefix = isAuth ? 'dg:auth' : 'dg:world';
    const title = isAuth ? 'Configurar AUTH' : 'Configurar WORLD';

    const host = new TextInputBuilder()
        .setCustomId(prefix + 'host')
        .setLabel('Host -> (IP o Localhost)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(defaults.host || 'localhost');

    const port = new TextInputBuilder()
        .setCustomId(prefix + 'port')
        .setLabel('Puerto')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(defaults.host || '3306');

    const user = new TextInputBuilder()
        .setCustomId(prefix + 'user')
        .setLabel('Usuario')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(defaults.host || 'root');

    const pass = new TextInputBuilder()
        .setCustomId(prefix + 'password')
        .setLabel('Contraseña (puede estar vacia)')
        .setStyle(TextInputStyle.Short)
        .setRequired(flase)
        .setValue(defaults.host || '');

    const dbname = new TextInputBuilder()
        .setCustomId(prefix + 'db')
        .setLabel('Nombre de la Base de datos')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(defaults.db || (isAuth ? 'auth' : 'world'));

    const modal = new ModalBuilder()
        .setCustomId(modalId)
        .setTitle(title)
        .addComponents(
            new ActionRowBuilder().addComponents(host),
            new ActionRowBuilder().addComponents(port),
            new ActionRowBuilder().addComponents(user),
            new ActionRowBuilder().addComponents(pass),
            new ActionRowBuilder().addComponents(dbname)
        );

    return modal;
}

async function getDbDefaults(db, kind) {
    const keys = kind === 'auth' ? AUTH_KEYS : WORLD_KEYS;
    const cfg = await db.config.getMany(keys);

    return {
        host: cfg[`${kind}.host`] || '',
        port: cfg[`${kind}.port`] || '',
        user: cfg[`${kind}.user`] || '',
        password: cfg[`${kind}.password`] || '',
        db: cfg[`${kind}.db`] || '',
    };
}

async function refreshPanel(interaction, db) {
    const state = await loadInstallState(db);
    const view = buildInstallView(state);

    if (interaction.isButton()) return interaction.update(view);
    return interaction.editReply(view);
}

async function testConnectionOnce({ host, port, user, password, database }) {
    const pool = mysql2.createPool({
        host,
        port: Number(port || 3306),
        user,
        password,
        database,
        waitForConnections: true,
        connectionLimit: 2,
        queueLimit: 0,
        enableKeepAlive: true,
    });

    try {
        await pool.query('SELECT 1');
        return { ok: true };
    } catch (err) {
        return { ok: false, err };
    } finally {
        try { await pool.end(); } catch (_) { }
    }
}

async function handleInstallButton(interaction, ctx) {
    if (!isAdmin(interaction)) {
        return interaction.reply({ content: 'No tienes permisos.', Flags: MessageFlags.ephemeral });
    }

    const { db } = ctx;
    const id = interaction.customId;

    if (id === IDS.BTN_AUTH) {
        const defaults = await getDbDefaults(db, 'auth');
        const modal = makeDbModal('auth', defaults);
        return interaction.showModal(modal);
    }

    if (id === IDS.BTN_WORLD) {
        const defaults = await getDbDefaults(db, 'world');
        const modal = makeDbModal('world', defaults);
        return interaction.showModal(modal);
    }

    if (id === IDS.BTN_RESET) {
        await db.config.delPrefix('auth.');
        await db.config.delPrefix('world.');
        await db.config.set('install.done', '0');

        await interaction.reply({ content: 'Configuración reiniciada.', Flags: MessageFlags.ephemeral });
        return refreshPanel(interaction, db);
    }

    if (id === IDS.BTN_FINISH) {
        const cfg = await db.config.getMany([...AUTH_KEYS, ...WORLD_KEYS]);

        const missingAuth = AUTH_KEYS.filter(k => !(cfg[k] && String(cfg[k]).length));
        const missingWorld = WORLD_KEYS.filter(k => !(cfg[k] && String(cfg[k]).length));

        if (missingAuth.length || missingWorld.length) {
            return interaction.reply({
                content: 'Falta configurar AUTH o WORLD antes de finalizar.',
                ephemeral: true,
            });
        }

        const authRes = await testConnectionOnce({
            host: cfg['auth.host'],
            port: cfg['auth.port'],
            user: cfg['auth.user'],
            password: cfg['auth.password'],
            database: cfg['auth.db'],
        });

        if (!authRes.ok) {
            return interaction.reply({
                content: `AUTH: fallo de conexión.\n${hintFromDbError(authRes.err, 'AUTH')}`,
                ephemeral: true,
            });
        }

        const worldRes = await testConnectionOnce({
            host: cfg['world.host'],
            port: cfg['world.port'],
            user: cfg['world.user'],
            password: cfg['world.password'],
            database: cfg['world.db'],
        });

        if (!worldRes.ok) {
            return interaction.reply({
                content: `WORLD: fallo de conexión.\n${hintFromDbError(worldRes.err, 'WORLD')}`,
                ephemeral: true,
            });
        }

        await db.config.set('install.done', '1');

        await interaction.reply({
            content: 'Instalación completada. Ya puedes usar DofusGrimorio.',
            ephemeral: true,
        });

        return refreshPanel(interaction, db);
    }
}

async function handleInstallModal(interaction, ctx) {
    if (!isAdmin(interaction)) {
        return interaction.reply({ content: 'No tienes permisos.', Flags: MessageFlags.ephemeral });
    }

    const { db } = ctx;

    const isAuth = interaction.customId === MODALS.AUTH;
    const prefix = isAuth ? 'dg:auth:' : 'dg:world:';
    const keyPrefix = isAuth ? 'auth.' : 'world.';

    const host = interaction.fields.getTextInputValue(prefix + 'host').trim();
    const port = interaction.fields.getTextInputValue(prefix + 'port').trim();
    const user = interaction.fields.getTextInputValue(prefix + 'user').trim();
    const password = interaction.fields.getTextInputValue(prefix + 'password');
    const dbname = interaction.fields.getTextInputValue(prefix + 'db').trim();

    if (!host || !port || !user || !dbname) {
        return interaction.reply({ content: 'Rellena host/puerto/usuario/nombre de BD.', Flags: MessageFlags.ephemeral });
    }

    await db.config.setMany({
        [`${keyPrefix}host`]: host,
        [`${keyPrefix}port`]: port,
        [`${keyPrefix}user`]: user,
        [`${keyPrefix}password`]: password ?? '',
        [`${keyPrefix}db`]: dbname,
    });

    await interaction.reply({
        content: `${isAuth ? 'AUTH' : 'WORLD'} guardado.`,
        ephemeral: true,
    });

    try {
        await refreshPanel(interaction, db);
    } catch (_) {

    }
}

module.exports = {
    handleInstallButton,
    handleInstallModal,
    loadInstallState,
};