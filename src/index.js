const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });


const { Client, GatewayIntentBits, MessageFlags } = require('discord.js');
const { createRuntimeDb } = require('./db/runtime.js');
const { handleInstallButton, handleInstallModal } = require('./commands/instalar/handler.js');
const { logInfo, logError } = require('./logger/logger.js');



const ctx = {
    db: createRuntimeDb(),
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

async function bootstrap() {
    //ctx.db = initDb(process.env);

    //await ctx.db.migrate();

    //const health = await ctx.db.health();
    //health.lines.forEach((l) => logInfo ? logInfo(l) : console.log(l));
    //if (!health.ok) {
    //  throw new Error('No se pudo conectar a una o más bases de datos. Revisa configuración.');
    //}
    client.on('interactionCreate', async (interaction) => {
        try {
            const { buildInstallView } = require('./commands/instalar/ui.js'); // ajusta si tu export es distinto

            if (interaction.isChatInputCommand() && interaction.commandName === 'instalar') {
                await interaction.deferReply({ Flags: MessageFlags.ephemeral });

                const state = {   
                    authConfigured: false,
                    worldConfigured: false,
                    tablesReady: false,
                    installed: false,
                };

                const view = buildInstallView(state);
                const msg = await interaction.editReply(view);

                ctx.installPanelId = msg.id;
                ctx.installPanelChannelId = interaction.channelId;
                return;
            }

            if (interaction.isButton() && interaction.customId.startsWith('dg:install:')) {
                return handleInstallButton(interaction, ctx);
            }

            if (interaction.isModalSubmit() && interaction.customId.startsWith('dg:modal:')) {
                return handleInstallModal(interaction, ctx);
            }

        } catch (err) {
            if (logError) logError(err, 'interactionCreate error');
            else console.error(err);

            if (interaction.isRepliable()) {
                try {
                    await interaction.reply({ content: 'Error interno.', Flags: MessageFlags.ephemeral });
                } catch (_) { }
            }
        }
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
