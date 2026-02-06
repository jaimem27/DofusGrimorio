const { buildGuildPayload: buildGuildUiPayload } = require('./ui.js');

async function fetchGuild(worldPool, name) {
    const [rows] = await worldPool.query(
        `
        SELECT
            g.Id,
            g.Name,
            g.CreationDate,
            g.Experience,
            g.Boost,
            g.Prospecting,
            g.Wisdom,
            g.Pods,
            g.MaxTaxCollectors,
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

async function fetchGuildLeader(worldPool, guildId) {
    const [rows] = await worldPool.query(
        `
        SELECT c.Name
        FROM guild_members gm
        INNER JOIN characters c ON c.Id = gm.CharacterId AND c.DeletedDate IS NULL
        WHERE gm.GuildId = ?
          AND gm.RankId = 1
        LIMIT 1;
        `,
        [guildId]
    );
    return rows?.[0]?.Name ?? null;
}

async function fetchGuildTaxCollectors(worldPool, guildId) {
    const [rows] = await worldPool.query(
        'SELECT COUNT(*) AS total FROM world_maps_taxcollector WHERE GuildId = ?;',
        [guildId]
    );
    return rows?.[0]?.total ?? rows?.[0]?.['COUNT(*)'] ?? 0;
}

async function buildGuildPayload(worldPool, guild) {
    const [level, members, leaderName, taxCollectorsCount] = await Promise.all([
        fetchGuildLevel(worldPool, guild.Experience),
        fetchGuildMemberCount(worldPool, guild.Id),
        fetchGuildLeader(worldPool, guild.Id),
        fetchGuildTaxCollectors(worldPool, guild.Id),
    ]);

    return buildGuildUiPayload({
        guild,
        level,
        members,
        leaderName,
        taxCollectorsCount,

    });
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