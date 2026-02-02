const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');
const { createRuntimeDb } = require('./db/runtime.js');
const { loadBootstrapConfig } = require('./db/bootstrap.js');
const { handleInstallButton, handleInstallModal, loadInstallState } = require('./commands/instalar/handler.js');
const { handleAccountsButton, handleAccountsModal, handleAccountsSelect } = require('./commands/cuentas/handler.js');
const { handlePerfilSelect, handlePerfilTabButton, handlePerfilButton } = require('./commands/perfil/handler.js');
const { logInfo, logError } = require('./logger/logger.js');



const ctx = {
    db: createRuntimeDb(),
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

function isAdmin(interaction) {
    const perms = interaction.memberPermissions;
    if (!perms) return false;
    return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}


function resolveBrandingPath(filename) {
    const jpgPath = path.resolve(__dirname, 'assets', 'bot', `${filename}.jpg`);
    if (fs.existsSync(jpgPath)) return jpgPath;

    const pngPath = path.resolve(__dirname, 'assets', 'bot', `${filename}.png`);
    if (fs.existsSync(pngPath)) return pngPath;

    return null;
}

async function fetchOnlinePlayers(db) {
    const worldPool = await db.getPool('world');
    if (!worldPool) return null;

    const windowMinutes = Number.parseInt(process.env.PRESENCE_ACTIVE_MINUTES || '5', 10);
    const activeMinutes = Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 60;
    const [rows] = await worldPool.query(
        `SELECT COUNT(*) AS total
         FROM accounts a
         LEFT JOIN world_maps_merchant wmm
           ON wmm.CharacterId = a.ConnectedCharacter
          AND wmm.AccountId = a.Id
          AND wmm.IsActive = 1
         WHERE a.ConnectedCharacter IS NOT NULL
           AND a.LastConnection > DATE_SUB(NOW(), INTERVAL ? MINUTE)
           AND wmm.CharacterId IS NULL`,
        [activeMinutes]
    );
    const total = rows?.[0]?.total ?? rows?.[0]?.['COUNT(*)'];
    return Number(total ?? 0);
}

async function fetchServerName(db) {
    const worldPool = await db.getPool('world');
    if (!worldPool) return null;

    const [rows] = await worldPool.query('SELECT Name FROM worlds ORDER BY Id ASC LIMIT 1');
    const name = rows?.[0]?.Name;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
}

async function updatePresence(db) {
    try {
        const onlinePlayers = await fetchOnlinePlayers(db);
        const serverName = await fetchServerName(db);
        const displayName = serverName || 'Dofus';
        const label = Number.isFinite(onlinePlayers)
            ? `${displayName} • ${onlinePlayers} jugadores online`
            : `${displayName} • jugadores online`;

        client.user.setPresence({
            status: 'online',
            activities: [
                {
                    name: label,
                    type: 0,
                },
            ],
        });
    } catch (err) {
        if (logError) logError(err, 'No se pudo actualizar el estado del bot');
        else console.error(err);
    }
}

async function bootstrap() {
    const bootstrapConfig = loadBootstrapConfig();
    if (bootstrapConfig) {
        try {
            await ctx.db.useMysqlConfig({
                host: bootstrapConfig.host,
                port: bootstrapConfig.port,
                user: bootstrapConfig.user,
                password: bootstrapConfig.password,
                database: bootstrapConfig.database,
            });
            if (logInfo) logInfo('Configuración de BD cargada desde dg_config.');
        } catch (err) {
            if (logError) logError(err, 'No se pudo cargar la configuración guardada de BD.');
        }
    }

    client.on('interactionCreate', async (interaction) => {
        try {
            const { buildInstallView } = require('./commands/instalar/ui.js');

            if (interaction.isChatInputCommand() && interaction.commandName === 'instalar') {
                if (!isAdmin(interaction)) {
                    return interaction.reply({
                        content: 'No tienes permisos de administrador para usar este comando.',
                        ephemeral: true,
                    });
                }

                await interaction.deferReply();

                const state = await loadInstallState(ctx.db);

                const view = buildInstallView(state);
                const msg = await interaction.editReply(view);

                ctx.installPanelId = msg.id;
                ctx.installPanelChannelId = interaction.channelId;
                return;
            }

            if (interaction.isChatInputCommand() && interaction.commandName === 'cuentas') {
                if (!isAdmin(interaction)) {
                    return interaction.reply({
                        content: 'No tienes permisos de administrador para usar este comando.',
                        ephemeral: true,
                    });
                }

                await interaction.deferReply();

                const { buildAccountsView } = require('./commands/cuentas/ui.js');
                const view = buildAccountsView();
                const msg = await interaction.editReply(view);

                ctx.accountsPanelId = msg.id;
                ctx.accountsPanelChannelId = interaction.channelId;
                return;
            }

            if (interaction.isChatInputCommand() && interaction.commandName === 'perfil') {
                const perfil = require('./commands/perfil.js');
                return perfil.execute(interaction, ctx);
            }

            if (interaction.isButton() && interaction.customId.startsWith('dg:install:')) {
                return handleInstallButton(interaction, ctx);
            }

            if (interaction.isButton() && interaction.customId.startsWith('acc:')) {
                return handleAccountsButton(interaction, ctx);
            }

            if (interaction.isButton() && interaction.customId.startsWith('perfil.btn:')) {
                return handlePerfilButton(interaction, ctx);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('dg:modal:')) {
                return handleInstallModal(interaction, ctx);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('acc.modal:')) {
                return handleAccountsModal(interaction, ctx);
            }

            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('acc')) {
                return handleAccountsSelect(interaction, ctx);
            }

            if (interaction.isStringSelectMenu() && interaction.customId.startsWith('perfil')) {
                return handlePerfilSelect(interaction, ctx);
            }

            if (interaction.isButton() && interaction.customId.startsWith('perfil.tab:')) {
                return handlePerfilTabButton(interaction, ctx);
            }

        } catch (err) {
            if (logError) logError(err, 'interactionCreate error');
            else console.error(err);

            if (interaction.isRepliable()) {
                try {
                    await interaction.reply({ content: 'Error interno.', ephemeral: true });
                } catch (_) { }
            }
        }
    });

    client.once('ready', async () => {
        if (process.env.SET_BRANDING === 'true') {
            const iconPath = resolveBrandingPath('icon');
            const bannerPath = resolveBrandingPath('banner')

            if (!iconPath) {
                (logError ? logError('No se encontró icon.jpg/icon.png en src/assets/bot') : console.error('No se encontró icon.jpg/icon.png en src/assets/bot'));
            } else {
                try {
                    await client.user.setAvatar(iconPath);
                    (logInfo ? logInfo('Icono del bot actualizado') : console.log('Icono del bot actualizado'));
                } catch (err) {
                    (logError ? logError(err, 'Error al actualizar icono del bot') : console.error(err));
                }
            }

            if (!bannerPath) {
                (logError ? logError('No se encontró banner.jpg/banner.png en src/assets/bot') : console.error('No se encontró banner.jpg/banner.png en src/assets/bot'));
            } else {
                try {
                    await client.user.setBanner(bannerPath);
                    (logInfo ? logInfo('Banner del bot actualizado') : console.log('Banner del bot actualizado'));
                } catch (err) {
                    (logError ? logError(err, 'Error al actualizar banner del bot') : console.error(err));
                }
            }
        }

        await updatePresence(ctx.db);
        setInterval(() => {
            updatePresence(ctx.db);
        }, Number(process.env.PRESENCE_REFRESH_MS || 60000));
    });

    // Login discord
    const token = process.env.DISCORD_TOKEN;
    if (!token) throw new Error('DISCORD_TOKEN no definido en .env');

    await client.login(token);
    (logInfo ? logInfo('Bot conectado a Discord') : console.log('Bot conectado a Discord'));
}

bootstrap().catch((err) => {
    if (logError) logError(err, 'Bootstrap fallido');
    else console.error(err);
    process.exit(1);
});
