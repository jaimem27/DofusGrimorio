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

async function buildAlliancePayload({ alliance, guildsCount }) {
    const embed = new EmbedBuilder()
        .setTitle(`🤝 Alianza: ${alliance.Name}`)
        .setColor(0x2f3136)
        .addFields(
            { name: 'Etiqueta', value: alliance.Tag ? `${alliance.Tag}` : '—', inline: true },
            { name: 'Gremios', value: formatNumber(guildsCount), inline: true },
            { name: 'Creada', value: formatDate(alliance.CreationDate), inline: true }
        );

    const emblemBuffer = await buildEmblemBuffer({
        backgroundFolder: 'backalliance',
        backgroundShape: alliance.EmblemBackgroundShape,
        backgroundColor: alliance.EmblemBackgroundColor,
        foregroundShape: alliance.EmblemForegroundShape,
        foregroundColor: alliance.EmblemForegroundColor,
    });

    if (!emblemBuffer) {
        return { embed, files: [] };
    }

    const attachment = new AttachmentBuilder(emblemBuffer, { name: 'emblem.png' });
    embed.setThumbnail('attachment://emblem.png');

    return { embed, files: [attachment] };
}

module.exports = {
    buildAlliancePayload,
};