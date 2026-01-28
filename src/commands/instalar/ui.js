const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const IDS = {
    BTN_AUTH: 'dg:install:auth',
    BTN_WORLD: 'dg:install:world',
    BTN_FINISH: 'dg:install:finish',
    BTN_RESET: 'dg:install:reset',
};

function statusLine(ok, label) {
    return ok ? `${label}: Configurado` : `${label}: Pendiente`;
}

function buildInstallEmbed(state) {
    const embed = new EmbedBuilder()
        .setTitle('📘 DofusGrimorio — Instalación')
        .setDescription(
            [
                'Configura la conexión a tu servidor Dofus desde aquí.',
                'Solo necesitas los datos de base de datos **AUTH** y **WORLD**.',
                '',
                '**Estado:**',
                `${statusLine(state.authConfigured, 'AUTH')}`,
                `${statusLine(state.worldConfigured, 'WORLD')}`,
                state.tablesReady ? 'Tablas Grimorio: OK' : 'Tablas Grimorio: Pendiente',
                state.installed ? 'Instalación: Completada' : 'Instalación: No finalizada',
            ].join('\n')
        )
        .setColor(0xff8000)
        .setFooter({ text: 'Tip: Configura AUTH y WORLD y luego pulsa “Probar y finalizar”.' });

    return embed;
}

function buildInstallButtons(state) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(IDS.BTN_AUTH)
            .setLabel('Configurar AUTH')
            .setEmoji('🛠️')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_WORLD)
            .setLabel('Configurar WORLD')
            .setEmoji('🌍')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_FINISH)
            .setLabel('Probar y finalizar')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!(state.authConfigured && state.worldConfigured)),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_RESET)
            .setLabel('Reiniciar instalación')
            .setEmoji('♻️')
            .setStyle(ButtonStyle.Danger)
    );

    return row;
}

function buildInstallView(state) {
    return {
        embeds: [buildInstallEmbed(state)],
        components: [buildInstallButtons(state)],
    };
}

module.exports = { buildInstallView, IDS };