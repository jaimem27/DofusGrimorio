const { buildProfileView } = require('./ui.js');

async function fetchNextLevelExp(pool, level) {
    const [rows] = await pool.query(
        'SELECT CharacterExp FROM experiences WHERE Level = ? LIMIT 1;',
        [level]
    );
    return rows?.[0]?.CharacterExp ?? null;
}

async function fetchSubareaName(pool, mapId) {
    const [rows] = await pool.query(
        'SELECT Name FROM world_subareas WHERE FIND_IN_SET(?, MapsIdsCSV) LIMIT 1;',
        [mapId]
    );
    return rows?.[0]?.Name ?? null;
}

async function fetchBreedName(pool, breedId) {
    const [rows] = await pool.query(
        'SELECT ShortName FROM breeds WHERE Id = ? LIMIT 1;',
        [breedId]
    );
    return rows?.[0]?.ShortName ?? null;
}

async function fetchAccountTokens(pool, accountId) {
    if (!pool) return null;
    const [rows] = await pool.query(
        'SELECT Tokens FROM accounts WHERE Id = ? LIMIT 1;',
        [accountId]
    );
    return rows?.[0]?.Tokens ?? null;
}

async function handlePerfilCommand(interaction, ctx) {
    const nombre = interaction.options.getString('nombre')?.trim() || null;

    if (!nombre) {
        await interaction.reply({
            ephemeral: true,
            content:
                'Escribe `/perfil nombre:<tu personaje>',
        });
        return;
    }

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        await interaction.reply({
            ephemeral: true,
            content: 'Configura primero la base de datos WORLD con `/instalar`.',
        });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const [rows] = await worldPool.query(
        `
        SELECT
          c.Id, c.Name, c.AccountId, c.Breed, c.Sex,
          c.MapId, c.CellId, c.Direction,
          c.BaseHealth, c.DamageTaken,
          c.AP, c.MP,
          c.Energy, c.EnergyMax,
          c.Kamas, c.Experience,
          c.CreationDate, c.LastUsage,
          (SELECT e.Level
           FROM experiences e
           WHERE e.CharacterExp <= c.Experience
           ORDER BY e.Level DESC
           LIMIT 1) AS Level
        FROM characters c
        WHERE c.Name = ?
          AND c.DeletedDate IS NULL
        LIMIT 1;
        `,
        [nombre]
    );

    const character = rows?.[0];
    if (!character) {
        await interaction.editReply({
            content: `No encontré el personaje **${nombre}**.`,
        });
        return;
    }

    const level = Number(character.Level ?? 1);
    const hpMax = Math.max(0, Number(character.BaseHealth ?? 0));
    const dmg = Math.max(0, Number(character.DamageTaken ?? 0));
    const hpNow = Math.max(0, hpMax - dmg);

    const nextExp = await fetchNextLevelExp(worldPool, level + 1);
    const xpCurrent = Number(character.Experience ?? 0);
    const xpRemaining =
        nextExp !== null && Number.isFinite(Number(nextExp))
            ? Math.max(0, Number(nextExp) - xpCurrent)
            : null;

    const [subareaName, breedName] = await Promise.all([
        fetchSubareaName(worldPool, character.MapId),
        fetchBreedName(worldPool, character.Breed),
    ]);
    const authPool = await ctx.db.getPool('auth');
    const tokens = await fetchAccountTokens(authPool, character.AccountId);

    const view = buildProfileView({
        character,
        level,
        hpNow,
        hpMax,
        xpCurrent,
        xpRemaining,
        subareaName,
        tokens,
        breedName,
    });

    await interaction.editReply(view);
}

module.exports = { handlePerfilCommand };