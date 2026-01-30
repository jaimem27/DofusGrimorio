const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const IDS = {
    BTN_CREATE: 'acc:create',
    BTN_PASS: 'acc:pass',
    BTN_UNSTUCK: 'acc:unstuck',
    BTN_HELP: 'acc:help',
};

function buildAccountsEmbed() {
    return new EmbedBuilder()
        .setTitle('🏛️ Centro de gestión de cuentas')
        .setDescription(
            [
                'Gestiona tus cuentas y soporte básico desde aquí.',
                'Las respuestas con datos sensibles siempre serán privadas.',
            ].join('\n')
        )
        .addFields(
            {
                name: 'Acciones',
                value: [
                    '```',
                    '✅ Crear cuenta(s)     (1–8 por usuario)',
                    '🔑 Cambiar contraseña  ',
                    '🧰 Desbuguear pj       ',
                    '🆘 Ayuda               (guía rápida)',
                    '```',
                ].join('\n'),
            },
            {
                name: 'Notas',
                value: [
                    '• Nombres / apariencia / gestión in-game.',
                    '• Todos los datos personales nunca se muestran en el canal y solo serán visibles para el usuario.',
                    '• Si algo falla: usa 🆘 Ayuda o contacta con el Staff.',
                ].join('\n'),
            }
        )
        .setColor(0x2f3136)
        .setFooter({ text: 'Panel de cuentas · Dofus Grimorio' });
}

function buildAccountsButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(IDS.BTN_CREATE)
            .setLabel('Crear cuenta(s)')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_PASS)
            .setLabel('Cambiar contraseña')
            .setEmoji('🔑')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_UNSTUCK)
            .setLabel('Desbuguear pj')
            .setEmoji('🧰')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_HELP)
            .setLabel('Ayuda')
            .setEmoji('🆘')
            .setStyle(ButtonStyle.Secondary)
    );
}

function buildAccountsView() {
    return {
        embeds: [buildAccountsEmbed()],
        components: [buildAccountsButtons()],
    };
}

module.exports = { buildAccountsView, IDS };