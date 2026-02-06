const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const IDS = {
    BTN_AUTH: 'dg:install:auth',
    BTN_WORLD: 'dg:install:world',
    BTN_FINISH: 'dg:install:finish',
    BTN_AUCTION: 'dg:install:auction',
    BTN_RESET: 'dg:install:reset',
};

function row(label, icon, text) {
    const col1 = label.padEnd(11, ' '); // ancho fijo (ajústalo si quieres)
    const sep = '│';                    // mejor que "·" para tabla
    return `${col1} ${sep} ${icon} ${text}`;
}

function buildInstallEmbed(state) {
    const statusLines = [
        row(
            'AUTH',
            state.authConfigured ? '🟢' : '🟡',
            state.authConfigured ? 'Configurado' : 'Pendiente'
        ),
        row(
            'WORLD',
            state.worldConfigured ? '🟢' : '🟡',
            state.worldConfigured ? 'Configurado' : 'Pendiente'
        ),
        row(
            'Tablas',
            state.tablesReady ? '🟢' : '🟡',
            state.tablesReady ? 'Creadas' : 'Pendiente'
        ),
        row(
            'Instalación',
            state.installed ? '🟢' : '🟡',
            state.installed ? 'Completada' : 'En proceso'
        ),
        row(
            'Subastas',
            state.auctionSupported ? (state.auctionConfigured ? '🟢' : '🟡') : '🔴',
            state.auctionSupported
                ? (state.auctionConfigured ? 'Canal configurado' : 'Pendiente')
                : 'No disponible'
        ),
    ];

    const embed = new EmbedBuilder()
        .setTitle('📘 Dofus Grimorio — Configuración de la Base de datos 📘')
        .setDescription(
            [
                'Configura la conexión a tu servidor Dofus desde aquí.',
                'Solo necesitas los datos de base de datos **AUTH** y **WORLD**.',
                '',
                '🧭 **Estado de la instalación**',
                '```',
                ...statusLines,
                '```',
                '',
                '💡 **Tip:** Configura **AUTH** y **WORLD** y luego pulsa **Probar y finalizar** para probar la conexión.',
            ].join('\n')
        )
        .setColor(0xff8000)
        .setFooter({ text: 'Asistente de instalación · Dofus Grimorio.' });

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
            .setCustomId(IDS.BTN_AUCTION)
            .setLabel('Configurar subasta')
            .setEmoji('🏷️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!(state.installed && state.auctionSupported)),
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