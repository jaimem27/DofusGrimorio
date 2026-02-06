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

async function fetchAlliance(worldPool, name) {
    const [rows] = await worldPool.query(
        `
        SELECT
            a.Id,
            a.Name,
            a.Tag,
            a.CreationDate,
            a.EmblemBackgroundShape,
            a.EmblemBackgroundColor,
            a.EmblemForegroundShape,
            a.EmblemForegroundColor,
            a.MotdContent
        FROM alliances a
        WHERE a.Name = ? OR a.Tag = ?
        LIMIT 1;
        `,
        [name, name]
    );
    return rows?.[0] ?? null;
}

async function fetchAllianceGuildCount(worldPool, allianceId) {
    const [rows] = await worldPool.query(
        'SELECT COUNT(*) AS total FROM guilds WHERE AllianceId = ?;',
        [allianceId]
    );
    return rows?.[0]?.total ?? rows?.[0]?.['COUNT(*)'] ?? 0;
}

async function buildAlliancePayload(worldPool, alliance) {
    const guildsCount = await fetchAllianceGuildCount(worldPool, alliance.Id);

    const embed = new EmbedBuilder()
        .setTitle(`🤝 Alianza: ${alliance.Name}`)
        .setColor(0x2f3136)
        .addFields(
            { name: 'Etiqueta', value: alliance.Tag ? `[${alliance.Tag}]` : '—', inline: true },
            { name: 'Gremios', value: formatNumber(guildsCount), inline: true },
            { name: 'Creada', value: formatDate(alliance.CreationDate), inline: true }
        );

    if (alliance.MotdContent) {
        embed.setDescription(`**Mensaje del día**\n${alliance.MotdContent}`);
    }

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

async function handleAllianceCommand(interaction, ctx) {
    const name = interaction.options.getString('nombre', true).trim();
    await interaction.deferReply();

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.editReply({
            content: 'La base de datos del mundo no está configurada.',
            embeds: [],
            files: [],
        });
    }

    const alliance = await fetchAlliance(worldPool, name);
    if (!alliance) {
        return interaction.editReply({
            content: 'No se encontró ninguna alianza con ese nombre.',
            embeds: [],
            files: [],
        });
    }

    const { embed, files } = await buildAlliancePayload(worldPool, alliance);
    return interaction.editReply({ embeds: [embed], files });
}

module.exports = {
    handleAllianceCommand,
};