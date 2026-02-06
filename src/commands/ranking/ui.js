const { EmbedBuilder } = require('discord.js');

const RANKING_LABELS = {
    level: 'Nivel',
    pvp: 'PvP',
    guilds: 'Gremios',
    achievements: 'Logros',
};

function buildRankingEmbed({ type, limit, filterLabel, lines }) {
    const titleSuffix = RANKING_LABELS[type] || 'Ranking';
    const body = lines.length ? lines.join('\n') : 'Sin registros disponibles.';
    const classLabel = filterLabel.classLabel ? ` · 🎭 ${filterLabel.classLabel}` : '';

    const description = [
        `🏆 **Top ${limit}** · 🌍 **${filterLabel.scopeLabel}**${classLabel}`,
        '━━━━━━━━━━━━━━━━━━━━━━━━━━',
        body,
    ].join('\n');

    return new EmbedBuilder()
        .setTitle(`📊 Ranking · ${titleSuffix}`)
        .setDescription(description)
        .setColor(0x2f3136)
        .setFooter({ text: '⌁ Datos desde BD · Actualiza al momento ⌁' });
}

module.exports = { buildRankingEmbed, RANKING_LABELS };