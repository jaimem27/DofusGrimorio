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

async function fetchGuild(worldPool, name) {
    const [rows] = await worldPool.query(
        `
        SELECT
            g.Id,
            g.Name,
            g.CreationDate,
            g.Experience,
            g.EmblemBackgroundShape,
            g.EmblemBackgroundColor,
            g.EmblemForegroundShape,
            g.EmblemForegroundColor,
            g.MotdContent,
            g.AllianceId,
            a.Name AS AllianceName,
            a.Tag AS AllianceTag
        FROM guilds g
        LEFT JOIN alliances a ON a.Id = g.AllianceId
        WHERE g.Name = ?
        LIMIT 1;
        `,
        [name]
    );
    return rows?.[0] ?? null;
}

async function fetchGuildLevel(worldPool, experience) {
    const [rows] = await worldPool.query(
        `
        SELECT Level
        FROM experiences
        WHERE GuildExp <= ?
        ORDER BY Level DESC
        LIMIT 1;
        `,
        [experience]
    );
    return rows?.[0]?.Level ?? null;
}

async function fetchGuildMemberCount(worldPool, guildId) {
    const [rows] = await worldPool.query(
        'SELECT COUNT(*) AS total FROM guild_members WHERE GuildId = ?;',
        [guildId]
    );
    return rows?.[0]?.total ?? rows?.[0]?.['COUNT(*)'] ?? 0;
}

async function buildGuildPayload(worldPool, guild) {
    const [level, members] = await Promise.all([
        fetchGuildLevel(worldPool, guild.Experience),
        fetchGuildMemberCount(worldPool, guild.Id),
    ]);

    const embed = new EmbedBuilder()
        .setTitle(`🏰 Gremio: ${guild.Name}`)
        .setColor(0x2f3136)
        .addFields(
            { name: 'Nivel', value: level ? String(level) : '—', inline: true },
            { name: 'Experiencia', value: formatNumber(guild.Experience), inline: true },
            { name: 'Miembros', value: formatNumber(members), inline: true },
            { name: 'Creado', value: formatDate(guild.CreationDate), inline: true }
        );

    if (guild.AllianceId) {
        const allianceLabel = guild.AllianceName
            ? `${guild.AllianceName}${guild.AllianceTag ? ` [${guild.AllianceTag}]` : ''}`
            : `#${guild.AllianceId}`;
        embed.addFields({ name: 'Alianza', value: allianceLabel, inline: true });
    }

    if (guild.MotdContent) {
        embed.setDescription(`**Mensaje del día**\n${guild.MotdContent}`);
    }

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

async function handleGuildCommand(interaction, ctx) {
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

    const guild = await fetchGuild(worldPool, name);
    if (!guild) {
        return interaction.editReply({
            content: 'No se encontró ningún gremio con ese nombre.',
            embeds: [],
            files: [],
        });
    }

    const { embed, files } = await buildGuildPayload(worldPool, guild);
    return interaction.editReply({ embeds: [embed], files });
}

module.exports = {
    handleGuildCommand,
};