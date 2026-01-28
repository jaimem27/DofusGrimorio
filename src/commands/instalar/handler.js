
const { PermissionFlagsBits, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { buildInstallView, IDS } = require('./ui.js');
const { dbHintFromError } = require('../../db/errorHints.js');
const { runMigrations } = require('../../db/migrate.js');
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
const AUTH_REQUIRED_KEYS = ['auth.host', 'auth.port', 'auth.user', 'auth.db'];
const WORLD_REQUIRED_KEYS = ['world.host', 'world.port', 'world.user', 'world.db'];

async function loadInstallState(db) {
    const cfg = await db.config.getMany([
        ...AUTH_KEYS,
        ...WORLD_KEYS,
        'install.done',
    ]);

    const authConfigured = AUTH_REQUIRED_KEYS.every(k => (cfg[k] ?? '').toString().length > 0);
    const worldConfigured = WORLD_REQUIRED_KEYS.every(k => (cfg[k] ?? '').toString().length > 0);
    const installed = (cfg['install.done'] ?? '0') === '1';

    return {
        authConfigured,
        worldConfigured,
        installed,
        tablesReady: db.isPersistent ? db.isPersistent() : true,
    };
}

function makeDbModal(kind, defaults = {}) {
    const isAuth = kind === 'auth';
    const modalId = isAuth ? MODALS.AUTH : MODALS.WORLD;

    const prefix = isAuth ? 'dg:auth:' : 'dg:world:';
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
        .setValue(defaults.port || '3306');

    const user = new TextInputBuilder()
        .setCustomId(prefix + 'user')
        .setLabel('Usuario')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(defaults.user || 'root');

    const pass = new TextInputBuilder()
        .setCustomId(prefix + 'password')
        .setLabel('Contraseña (puede estar vacia)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setValue(defaults.password || '');

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

async function refreshPanel(interaction, ctx) {
    const state = await loadInstallState(ctx.db);
    const view = buildInstallView(state);

    // Botones: actualizan el mismo mensaje
    if (interaction.isButton()) {
        if (interaction.replied || interaction.deferred) {
            if (interaction.message?.editable) {
                return interaction.message.edit(view);
            }
            return interaction.editReply(view);
        }
        return interaction.update(view);
    }

    // Modals: NO tienen message -> editamos el panel guardado
    const channelId = ctx.installPanelChannelId || interaction.channelId;
    const panelId = ctx.installPanelId;

    if (!channelId || !panelId) return;

    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) return;

    const panelMsg = await channel.messages.fetch(panelId).catch(() => null);
    if (!panelMsg) return;

    await panelMsg.edit(view);
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
        return interaction.reply({ content: 'No tienes permisos.', ephemeral: true });
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

        await interaction.deferUpdate();
        return refreshPanel(interaction, ctx);
    }

    if (id === IDS.BTN_FINISH) {
        const cfg = await db.config.getMany([...AUTH_KEYS, ...WORLD_KEYS]);

        const missingAuth = AUTH_REQUIRED_KEYS.filter(k => !(cfg[k] && String(cfg[k]).length));
        const missingWorld = WORLD_REQUIRED_KEYS.filter(k => !(cfg[k] && String(cfg[k]).length));

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
                content: `AUTH: fallo de conexión.\n${dbHintFromError(authRes.err, 'AUTH')}`,
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
                content: `WORLD: fallo de conexión.\n${dbHintFromError(worldRes.err, 'WORLD')}`,
                ephemeral: true,
            });
        }


        {
            const conn = await mysql2.createConnection({
                host: cfg['auth.host'],
                port: Number(cfg['auth.port']),
                user: cfg['auth.user'],
                password: cfg['auth.password'],
            });

            await conn.query(
                `CREATE DATABASE IF NOT EXISTS \`${cfg['auth.db']}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
            );

            await conn.end();
        }

        {
            const conn = await mysql2.createConnection({
                host: cfg['world.host'],
                port: Number(cfg['world.port']),
                user: cfg['world.user'],
                password: cfg['world.password'],
            });

            await conn.query(
                `CREATE DATABASE IF NOT EXISTS \`${cfg['world.db']}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
            );

            await conn.end();
        }

        await db.config.set('install.done', '1');

        await interaction.reply({
            content: 'Instalación completada. Ya puedes usar DofusGrimorio.',
            ephemeral: true,
        });

        return refreshPanel(interaction, ctx);
    }
}

async function handleInstallModal(interaction, ctx) {
    if (!isAdmin(interaction)) {
        return interaction.reply({ content: 'No tienes permisos.', ephemeral: true });
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
        return interaction.reply({ content: 'Rellena host/puerto/usuario/nombre de BD.', ephemeral: true });
    }

    if (isAuth) {
        try {
            const conn = await mysql2.createConnection({
                host,
                port: Number(port),
                user,
                password,
            });

            await conn.query(
                `CREATE DATABASE IF NOT EXISTS \`${dbname}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
            );

            await conn.end();

            const pool = mysql2.createPool({
                host,
                port: Number(port || 3306),
                user,
                password,
                database: dbname,
                waitForConnections: true,
                connectionLimit: 2,
                queueLimit: 0,
                enableKeepAlive: true,
            });

            try {
                await runMigrations(pool);
            } finally {
                await pool.end();
            }

            await ctx.db.useMysqlConfig({
                host,
                port,
                user,
                password,
                database: dbname,
                migrate: false,
            });
        } catch (err) {
            return interaction.reply({
                content: `No se pudo preparar la base de datos AUTH.\n${dbHintFromError(err, 'AUTH')}`,
                ephemeral: true,
            });
        }
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
        await refreshPanel(interaction, ctx);
    } catch (_) {

    }
}

module.exports = {
    handleInstallButton,
    handleInstallModal,
    loadInstallState,
};
