const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const IDS = {
    BTN_VOTE: 'social:vote',
    BTN_REDEEM: 'social:redeem',
    BTN_JOBS: 'social:jobs',
};

function buildSocialEmbed() {
    return new EmbedBuilder()
        .setTitle('🤝 Centro social')
        .setDescription(
            [
                'Participa en la comunidad, apoya el servidor y obtén recompensas.\n',
                'Aquí encontrarás las funciones sociales disponibles del Grimorio.',
            ].join('\n')
        )
        .addFields({
            name: 'Acciones',
            value: [
                '```',
                '🗳️ Votar y reclamar tokens',
                '🎁 Reclamar código',
                '🔎 Buscar oficio',
                '```',
            ].join('\n'),
        })
        .setColor(0x2f3136)
        .setFooter({ text: 'Panel social · Dofus Grimorio' });
}

function buildSocialButtons() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(IDS.BTN_VOTE)
            .setLabel('Votar')
            .setEmoji('🗳️')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_REDEEM)
            .setLabel('Reclamar código')
            .setEmoji('🎁')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_JOBS)
            .setLabel('Buscar oficio')
            .setEmoji('🔎')
            .setStyle(ButtonStyle.Primary),
    );
}

function buildSocialView() {
    return {
        embeds: [buildSocialEmbed()],
        components: [buildSocialButtons()],
    };
}

module.exports = { buildSocialView, IDS };