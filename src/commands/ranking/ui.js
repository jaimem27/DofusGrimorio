const { EmbedBuilder } = require('discord.js');

const RANKING_LABELS = {
    level: 'Nivel',
    pvp: 'PvP',
    guilds: 'Gremios',
    achievements: 'Logros',
};

function buildRankingEmbed({ type, limit, filterLabel, lines }) {
    const titleSuffix = RANKING_LABELS[type] || 'Ranking';
    const body = lines.length
        ? ['```', lines.join('\n\n'), '```'].join('\n')
        : 'Sin registros disponibles.';

    const description = [
        `🏆 **Top ${limit}** · 🔎 **${filterLabel}**`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━',
        body,
    ].join('\n');

    return new EmbedBuilder()
        .setTitle(`📊 Ranking por ${titleSuffix}`)
        .setDescription(description)
        .setColor(0x2f3136)
        .setFooter({ text: '✨ Ranking · Dofus Grimorio' });
}

module.exports = { buildRankingEmbed, RANKING_LABELS };