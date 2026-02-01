const { buildProfileView } = require('./ui.js');
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const SELECTS = {
    ACCOUNT: 'perfil.sel:account',
    CHARACTER: 'perfil.sel:character',
};

async function fetchNextLevelExp(pool, level) {
    const [rows] = await pool.query(
        'SELECT CharacterExp FROM experiences WHERE Level = ? LIMIT 1;',
        [level]
    );
    return rows?.[0]?.CharacterExp ?? null;
}

async function fetchLevelExp(pool, level) {
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

async function loadLinkedAccounts(pool, discordUserId) {
    if (!pool) return [];
    const [rows] = await pool.query(
        `
        SELECT a.Id, a.Login, a.Nickname, a.LastConnection
        FROM accounts a
        INNER JOIN dg_discord_account d ON d.account_id = a.Id
        WHERE d.discord_user_id = ?
        ORDER BY a.Id ASC
        `,
        [discordUserId]
    );
    return rows ?? [];
}

async function loadCharactersForAccount(pool, accountId) {
    const [rows] = await pool.query(
        `
        SELECT Id, Name, LastUsage, MapId
        FROM characters
        WHERE AccountId = ?
          AND DeletedDate IS NULL
        ORDER BY Name ASC
        `,
        [accountId]
    );
    return rows ?? [];
}

async function loadCharacterByName(pool, name) {
    const [rows] = await pool.query(
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
        [name]
    );
    return rows?.[0] ?? null;
}

async function loadCharacterById(pool, charId) {
    const [rows] = await pool.query(
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
        WHERE c.Id = ?
          AND c.DeletedDate IS NULL
        LIMIT 1;
        `,
        [charId]
    );
    return rows?.[0] ?? null;
}

function buildAccountSelect(options) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECTS.ACCOUNT)
        .setPlaceholder('Elige tu cuenta')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

function buildCharacterSelect(accountId, options) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`${SELECTS.CHARACTER}:${accountId}`)
        .setPlaceholder('Elige tu personaje')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

function clampPercent(value) {
    if (!Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, value));
}

async function buildProfileData(ctx, worldPool, character) {
    const level = Number(character.Level ?? 1);
    const hpMax = Math.max(0, Number(character.BaseHealth ?? 0));
    const dmg = Math.max(0, Number(character.DamageTaken ?? 0));
    const hpNow = Math.max(0, hpMax - dmg);

    const [currentExpLevel, nextExp] = await Promise.all([
        fetchLevelExp(worldPool, level),
        fetchNextLevelExp(worldPool, level + 1),
    ]);
    const xpCurrent = Number(character.Experience ?? 0);
    const xpRemaining =
        nextExp !== null && Number.isFinite(Number(nextExp))
            ? Math.max(0, Number(nextExp) - xpCurrent)
            : null;
    const xpPercentRaw =
        currentExpLevel !== null && nextExp !== null && Number(nextExp) > Number(currentExpLevel)
            ? ((xpCurrent - Number(currentExpLevel)) / (Number(nextExp) - Number(currentExpLevel))) * 100
            : null;
    const xpPercent = clampPercent(xpPercentRaw);
    const [subareaName, breedName] = await Promise.all([
        fetchSubareaName(worldPool, character.MapId),
        fetchBreedName(worldPool, character.Breed),
    ]);
    const authPool = await ctx.db.getPool('auth');
    const tokens = await fetchAccountTokens(authPool, character.AccountId);

    return buildProfileView({
        character,
        level,
        hpNow,
        hpMax,
        xpPercent,
        xpRemaining,
        subareaName,
        tokens,
        breedName,
    });
}

async function handlePerfilCommand(interaction, ctx) {
    const nombre = interaction.options.getString('nombre')?.trim() || null;

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        await interaction.reply({
            ephemeral: true,
            content: 'Configura primero la base de datos WORLD con `/instalar`.',
        });
        return;
    }

    if (!nombre) {
        const authPool = await ctx.db.getPool('auth');
        if (!authPool) {
            return interaction.reply({
                ephemeral: true,
                content: 'Configura primero la base de datos AUTH con `/instalar`.',
            });
        }

        const accounts = await loadLinkedAccounts(authPool, interaction.user.id);
        if (!accounts.length) {
            return interaction.reply({
                ephemeral: true,
                content: '🔴 No tienes cuentas vinculadas. Usa `/cuentas` para crear o vincular.',
            });
        }

        const options = accounts.map((account) => ({
            label: account.Nickname || account.Login || `Cuenta #${account.Id}`,
            description: account.Login && account.Nickname ? `Usuario: ${account.Login}` : undefined,
            value: String(account.Id),
        }));

        const selectRow = buildAccountSelect(options);

        return interaction.reply({
            content: '👤 **Perfil**\nElige la cuenta que quieres revisar:',
            components: [selectRow],
        });
    }

    await interaction.deferReply({  });

    const character = await loadCharacterByName(worldPool, nombre);
    if (!character) {
        await interaction.editReply({
            content: `No encontré el personaje **${nombre}**.`,
        });
        return;
    }

    const view = await buildProfileData(ctx, worldPool, character);

    await interaction.editReply(view);
}

async function handlePerfilAccountSelect(interaction, ctx) {
    await interaction.deferUpdate();

    const authPool = await ctx.db.getPool('auth');
    const worldPool = await ctx.db.getPool('world');
    if (!authPool || !worldPool) {
        return interaction.editReply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            components: [],
        });
    }

    const accountId = Number.parseInt(interaction.values?.[0], 10);
    if (!Number.isFinite(accountId)) {
        return interaction.editReply({
            content: '🔴 Selección inválida. Intenta nuevamente.',
            components: [],
        });
    }

    const [rows] = await authPool.query(
        `SELECT 1 FROM dg_discord_account WHERE discord_user_id = ? AND account_id = ? LIMIT 1`,
        [interaction.user.id, accountId]
    );

    if (!rows.length) {
        return interaction.editReply({
            content: '🔴 Acceso denegado.',
            components: [],
        });
    }

    const characters = await loadCharactersForAccount(worldPool, accountId);
    if (!characters.length) {
        return interaction.editReply({
            content: '🔴 Esa cuenta no tiene personajes.',
            components: [],
        });
    }

    const options = characters.map((character) => ({
        label: character.Name,
        value: String(character.Id),
        description: character.LastUsage
            ? `Último uso: ${new Intl.DateTimeFormat('es-ES', {
                dateStyle: 'medium',
                timeStyle: 'short',
            }).format(new Date(character.LastUsage))}`
            : `Mapa: ${character.MapId ?? 'N/A'}`,
    }));

    const selectRow = buildCharacterSelect(accountId, options);

    return interaction.editReply({
        content: '👤 **Perfil**\nElige el personaje:',
        components: [selectRow],
    });
}

async function handlePerfilCharacterSelect(interaction, ctx) {
    await interaction.deferUpdate();

    const authPool = await ctx.db.getPool('auth');
    const worldPool = await ctx.db.getPool('world');
    if (!authPool || !worldPool) {
        return interaction.editReply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            components: [],
        });
    }

    const parts = interaction.customId.split(':');
    const accountId = Number.parseInt(parts[parts.length - 1], 10);
    const charId = Number.parseInt(interaction.values?.[0], 10);

    if (!Number.isFinite(accountId) || !Number.isFinite(charId)) {
        return interaction.editReply({
            content: '🔴 Selección inválida. Intenta nuevamente.',
            components: [],
        });
    }

    const [rows] = await authPool.query(
        `SELECT 1 FROM dg_discord_account WHERE discord_user_id = ? AND account_id = ? LIMIT 1`,
        [interaction.user.id, accountId]
    );

    if (!rows.length) {
        return interaction.editReply({
            content: '🔴 Acceso denegado.',
            components: [],
        });
    }

    const character = await loadCharacterById(worldPool, charId);
    if (!character || Number(character.AccountId) !== accountId) {
        return interaction.editReply({
            content: '🔴 Acceso denegado.',
            components: [],
        });
    }

    const view = await buildProfileData(ctx, worldPool, character);

    return interaction.editReply({
        ...view,
        components: [],
    });
}

async function handlePerfilSelect(interaction, ctx) {
    if (interaction.customId === SELECTS.ACCOUNT) {
        return handlePerfilAccountSelect(interaction, ctx);
    }
    if (interaction.customId.startsWith(`${SELECTS.CHARACTER}:`)) {
        return handlePerfilCharacterSelect(interaction, ctx);
    }
    return interaction.reply({
        content: '🔴 Acción no reconocida.',
        ephemeral: true,
    });
}

module.exports = { handlePerfilCommand, handlePerfilSelect };