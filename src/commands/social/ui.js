const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const IDS = {
    BTN_VOTE: 'social:vote',
    BTN_RANKINGS: 'social:rankings',
    BTN_COMMUNITY: 'social:community',
};

function buildSocialEmbed() {
    return new EmbedBuilder()
        .setTitle('🤝 Centro social')
        .setDescription(
            [
                'Participa en la comunidad y consigue recompensas.',
                'Los botones con candado se activarán en próximas fases.',
            ].join('\n')
        )
        .addFields({
            name: 'Acciones',
            value: [
                '```',
                '🗳️ Votar y reclamar tokens',
                '🏆 Rankings (próximamente)',
                '🌐 Comunidad (próximamente)',
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
            .setCustomId(IDS.BTN_RANKINGS)
            .setLabel('Rankings')
            .setEmoji('🏆')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(IDS.BTN_COMMUNITY)
            .setLabel('Comunidad')
            .setEmoji('🌐')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
    );
}

function buildSocialView() {
    return {
        embeds: [buildSocialEmbed()],
        components: [buildSocialButtons()],
    };
}

module.exports = { buildSocialView, IDS };