const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { buildEmblemBuffer } = require('../../utils/emblemGenerator.js');

function formatNumber(value) {
    return new Intl.NumberFormat('es-ES').format(Number(value) || 0);
}

function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
}

async function buildGuildPayload({ guild, level, members, leaderName, taxCollectorsCount }) {
    const accentColor = Number(guild.EmblemForegroundColor);
    const embedColor = Number.isFinite(accentColor) ? accentColor : 0x2f3136;

    const embed = new EmbedBuilder()
        .setTitle('🏰 Gremio')
        .setColor(embedColor);

    const descriptionLines = [`**${guild.Name}**`];

    embed.setDescription(descriptionLines.join('\n'));

    const fields = [
        { name: 'Nivel', value: level ? `**${level}**` : '—', inline: true },
        { name: 'Experiencia', value: `**${formatNumber(guild.Experience)}**`, inline: true },
        { name: 'Miembros', value: `**${formatNumber(members)}**`, inline: true },
        { name: '-----------------------------------------------------------------------------', value: '\u200B', inline: false },
        { name: 'Líder', value: leaderName ?? '—', inline: true },
        { name: 'Boost', value: formatNumber(guild.Boost), inline: true },
        { name: 'Prospección', value: formatNumber(guild.Prospecting), inline: true },
        { name: 'Sabiduría', value: formatNumber(guild.Wisdom), inline: true },
        { name: 'Pods', value: formatNumber(guild.Pods), inline: true },
        { name: 'Máx. recaudadores', value: formatNumber(guild.MaxTaxCollectors), inline: true },
        { name: 'Recaudadores colocados', value: formatNumber(taxCollectorsCount), inline: true },
    ];

    if (guild.AllianceId) {
        const allianceLabel = guild.AllianceName
            ? `${guild.AllianceName}${guild.AllianceTag ? ` ${guild.AllianceTag}` : ''}`
            : `#${guild.AllianceId}`;
        fields.push({ name: 'Alianza', value: allianceLabel, inline: true });
    }

    fields.push({
        name: 'Creado',
        value: formatDate(guild.CreationDate),
        inline: false,
    });

    embed.addFields(fields);

    const emblemBuffer = await buildEmblemBuffer({
        backgroundFolder: 'back',
        backgroundShape: guild.EmblemBackgroundShape,
        backgroundColor: guild.EmblemBackgroundColor,
        foregroundShape: guild.EmblemForegroundShape,
        foregroundColor: guild.EmblemForegroundColor,
    });

    if (!emblemBuffer) {
        return { embed, files: [] };
    }

    const attachment = new AttachmentBuilder(emblemBuffer, { name: 'emblem.png' });
    embed.setThumbnail('attachment://emblem.png');

    return { embed, files: [attachment] };
}

module.exports = {
    buildGuildPayload,
};