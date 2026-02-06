const { buildAlliancePayload: buildAllianceUiPayload } = require('./ui.js');

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

    return buildAllianceUiPayload({ alliance, guildsCount });
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