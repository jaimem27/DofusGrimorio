const { buildProfileView, buildStatsView, buildEquipmentView, buildStatsBlock, buildItemStatsView } = require('./ui.js');
const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder,
} = require('discord.js');
const { deserializeEffects } = require('../../utils/objectEffectsSerializer.js');
const { resolveEquipmentBasePath, resolveEquipmentIconPath } = require('../../utils/equipmentAssets.js');
const { buildEquipmentImage } = require('../../utils/equipmentImage.js');

const PROFILE_TABS = {
    SUMMARY: 'summary',
    STATS: 'stats',
    EQUIPMENT: 'equipment',
};

const SELECTS = {
    ACCOUNT: 'perfil:select:account',
    CHARACTER: 'perfil:select:character',
    EQUIPMENT: 'perfil:select:equip',
};

const EQUIPMENT_SLOTS = {
    0: 'Amuleto',
    1: 'Arma',
    2: 'Anillo (izq.)',
    3: 'Cinturón',
    4: 'Anillo (der.)',
    5: 'Botas',
    6: 'Sombrero',
    7: 'Capa',
    8: 'Mascota',
    9: 'Dofus 1',
    10: 'Dofus 2',
    11: 'Dofus 3',
    12: 'Dofus 4',
    13: 'Dofus 5',
    14: 'Dofus 6',
    15: 'Escudo',
    16: 'Montura',
    17: 'Compañero',
    18: 'Mascota viva',
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

async function fetchAlignmentLevel(pool, honor) {
    if (!Number.isFinite(Number(honor))) return null;
    const [rows] = await pool.query(
        'SELECT Level FROM experiences WHERE AlignmentHonor <= ? ORDER BY Level DESC LIMIT 1;',
        [honor]
    );
    return rows?.[0]?.Level ?? null;
}

async function fetchSubareaName(pool, mapId) {
    const [rows] = await pool.query(
        'SELECT Name FROM world_subareas WHERE FIND_IN_SET(?, MapsIdsCSV) LIMIT 1;',
        [mapId]
    );
    return rows?.[0]?.Name ?? null;
}

async function fetchGuildName(pool, characterId) {
    const [rows] = await pool.query(
        `
        SELECT g.Name
        FROM guild_members gm
        INNER JOIN guilds g ON g.Id = gm.GuildId
        WHERE gm.CharacterId = ?
        LIMIT 1;
        `,
        [characterId]
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

async function loadEquippedItems(pool, characterId) {
    const [rows] = await pool.query(
        `
        SELECT
          ci.ItemId,
          ci.Position,
          ci.SerializedEffects,
          COALESCE(w.Name, t.Name) AS ItemName,
          COALESCE(w.Level, t.Level) AS ItemLevel,
          COALESCE(w.IconId, t.IconId) AS IconId
          FROM characters_items ci
          LEFT JOIN items_templates t ON t.Id = ci.ItemId
          LEFT JOIN items_templates_weapons w ON w.Id = ci.ItemId
          WHERE ci.OwnerId = ?
          AND ci.Position >= 0
          AND ci.Position <= 18
        ORDER BY Position ASC;
        `,
        [characterId]
    );
    return rows ?? [];
}

function parseSerializedEffects(buffer) {
    if (!buffer) return [];
    try {
        return deserializeEffects(buffer);
    } catch (error) {
        return [
            {
                type: 'ParseError',
                message: error instanceof Error ? error.message : 'Error desconocido',
            },
        ];
    }
}

function formatEffect(effect) {
    if (effect.type === 'ParseError') {
        return `⚠️ ${effect.message}`;
    }
    if (effect.display) {
        return effect.display;
    }
    if (effect.full === false) {
        return effect.label ?? effect.type ?? `Efecto ${effect.id}`;
    }
    if (effect.label) {
        return effect.label;
    }
    return effect.type ?? `Efecto ${effect.id}`;
}

function summarizeItemEffects(effects, limit = 6) {
    if (!effects.length) return 'Sin efectos';
    const lines = effects.slice(0, limit).map(formatEffect);
    if (effects.length > limit) {
        lines.push(`… +${effects.length - limit} más`);
    }
    return lines.join(' · ');
}

function formatItemName(item) {
    return item.ItemName?.trim() || `Obj ${item.ItemId}`;
}

function formatItemLevel(item) {
    if (Number.isFinite(Number(item.ItemLevel))) {
        return `Nv. ${item.ItemLevel}`;
    }
    return 'Nv. —';
}

function buildEquipmentSummary(items) {
    if (!items.length) return 'Sin equipamiento.';
    const lines = items.map(item => {
        const slot = EQUIPMENT_SLOTS[item.Position] ?? `Pos ${item.Position}`;
        const effects = parseSerializedEffects(item.SerializedEffects);
        const effectsSummary = summarizeItemEffects(effects);
        const name = formatItemName(item);
        const level = formatItemLevel(item);
        return `**${slot}** · ${name} (${level}) · ${effectsSummary}`;
    });
    const summary = lines.join('\n');
    if (summary.length <= 1024) {
        return summary;
    }
    return `${summary.slice(0, 1000)}\n…`;
}

function buildEquipmentBySlot(items) {
    return items.reduce((acc, item) => {
        const position = Number(item.Position);
        acc[position] = {
            itemId: item.ItemId,
            name: formatItemName(item),
            level: item.ItemLevel,
            iconId: item.IconId,
            effects: parseSerializedEffects(item.SerializedEffects),
        };
        return acc;
    }, {});
}

function renderEquipmentLines(equipmentBySlot) {
    const lines = [];

    for (const [slotIdStr, slotName] of Object.entries(EQUIPMENT_SLOTS)) {
        const slotId = Number(slotIdStr);
        const it = equipmentBySlot?.[slotId];
        const itemName = it?.name?.trim() ? it.name.trim() : '—';
        lines.push(`**${slotName}:** ${itemName}`);
    }

    return lines.join('\n');
}

function buildEquipmentPreview(items) {
    const equipmentBySlot = buildEquipmentBySlot(items);
    return renderEquipmentLines(equipmentBySlot) || 'Sin equipamiento.';
}

function buildEquipmentDetails(items) {
    const lines = buildEquipmentPreview(items);
    if (lines.length <= 1024) {
        return lines;
    }
    return `${lines.slice(0, 1000)}\n…`;
}

function buildEquippedSelectOptions(items) {
    const equipmentBySlot = buildEquipmentBySlot(items);
    const options = [];

    for (const [slotIdStr, slotName] of Object.entries(EQUIPMENT_SLOTS)) {
        const slotId = Number(slotIdStr);
        const it = equipmentBySlot?.[slotId];
        if (!it?.name) continue;
        const label = `${slotName} — ${it.name}`.slice(0, 100);
        options.push({
            label,
            value: String(slotId),
            description: Number.isFinite(Number(it.level)) ? `Nivel ${it.level}` : undefined,
        });
    }

    return options.length ? options : [{ label: 'No hay items equipados', value: 'none' }];
}

function buildEquipmentStatsSelect(characterId, options) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`${SELECTS.EQUIPMENT}:${characterId}`)
        .setPlaceholder('Elige un objeto')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

function buildEquipmentActions(characterId, { includeStats = true } = {}) {
    const row = new ActionRowBuilder();

    if (includeStats) {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`perfil.btn:equipstats:${characterId}`)
                .setLabel('📊 Ver stats')
                .setStyle(ButtonStyle.Primary)
        );
    }
    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`perfil.btn:summary:${characterId}`)
            .setLabel('⬅️ Volver')
            .setStyle(ButtonStyle.Secondary)
    );

    return row;
}

async function buildEquipmentImageAttachment(equipmentBySlot) {
    const basePath = resolveEquipmentBasePath();
    if (!basePath) return null;
    const buffer = await buildEquipmentImage({
        basePath,
        equipmentBySlot,
        resolveIconPath: (item) => resolveEquipmentIconPath(item?.itemId ?? item?.ItemId),
    });
    if (!buffer) return null;
    return new AttachmentBuilder(buffer, { name: 'equipamiento.png' });
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
          c.Strength, c.Intelligence, c.Chance, c.Agility, c.Vitality, c.Wisdom,
          c.PermanentAddedStrength, c.PermanentAddedIntelligence, c.PermanentAddedChance,
          c.PermanentAddedAgility, c.PermanentAddedVitality, c.PermanentAddedWisdom,
          c.Prospection,
          c.AlignmentSide, c.Honor,
          c.ChallengesCount, c.ChallengesInDungeonCount,
          c.AchievementPoints,
          c.WinPvm, c.LosPvm,
          c.WinPvp, c.LosPvp,
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
          c.Strength, c.Intelligence, c.Chance, c.Agility, c.Vitality, c.Wisdom,
          c.PermanentAddedStrength, c.PermanentAddedIntelligence, c.PermanentAddedChance,
          c.PermanentAddedAgility, c.PermanentAddedVitality, c.PermanentAddedWisdom,
          c.Prospection,
          c.AlignmentSide, c.Honor,
          c.ChallengesCount, c.ChallengesInDungeonCount,
          c.AchievementPoints,
          c.WinPvm, c.LosPvm,
          c.WinPvp, c.LosPvp,
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

function buildProfileButtons(characterId, activeTab) {
    const buttons = [
        {
            id: PROFILE_TABS.SUMMARY,
            label: 'Resumen',
        },
        {
            id: PROFILE_TABS.STATS,
            label: 'Stats',
        },
        {
            id: PROFILE_TABS.EQUIPMENT,
            label: 'Equipamiento',
        },
    ];

    const row = new ActionRowBuilder();

    buttons.forEach((button) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`perfil.tab:${button.id}:${characterId}`)
                .setLabel(button.label)
                .setStyle(button.id === activeTab ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(button.id === activeTab)
        );
    });

    return row;
}

function clampPercent(value) {
    if (!Number.isFinite(value)) return null;
    return Math.min(100, Math.max(0, value));
}

async function buildProfileData(ctx, worldPool, character, tab = PROFILE_TABS.SUMMARY) {
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
    const [subareaName, breedName, guildName, equippedItems] = await Promise.all([
        fetchSubareaName(worldPool, character.MapId),
        fetchBreedName(worldPool, character.Breed),
        fetchGuildName(worldPool, character.Id),
        loadEquippedItems(worldPool, character.Id),
    ]);
    const authPool = await ctx.db.getPool('auth');
    const tokens = await fetchAccountTokens(authPool, character.AccountId);
    const equipmentSummary = buildEquipmentSummary(equippedItems);
    const equipmentDetails = buildEquipmentDetails(equippedItems);
    const equipmentBySlot = tab === PROFILE_TABS.EQUIPMENT ? buildEquipmentBySlot(equippedItems) : null;
    const equipmentImage =
        tab === PROFILE_TABS.EQUIPMENT && equipmentBySlot
            ? await buildEquipmentImageAttachment(equipmentBySlot)
            : null;
    const equipmentSelectRow =
        tab === PROFILE_TABS.EQUIPMENT
            ? buildEquipmentStatsSelect(character.Id, buildEquippedSelectOptions(equippedItems))
            : null;
    const alignmentLevel =
        tab === PROFILE_TABS.STATS ? await fetchAlignmentLevel(worldPool, character.Honor) : null;
    const statsBlock =
        tab === PROFILE_TABS.STATS ? buildStatsBlock(character, alignmentLevel) : null;

    return {
        view: buildProfileView({
            character,
            level,
            hpNow,
            hpMax,
            xpPercent,
            xpRemaining,
            subareaName,
            tokens,
            breedName,
            guildName,
            equipmentSummary,
            equipmentDetails,
            statsBlock,
            equipmentImage,
            tab,
        }),
        extraComponents: equipmentSelectRow ? [equipmentSelectRow] : [],
    };
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

    await interaction.deferReply({});

    const character = await loadCharacterByName(worldPool, nombre);
    if (!character) {
        await interaction.editReply({
            content: `No encontré el personaje **${nombre}**.`,
        });
        return;
    }

    const { view } = await buildProfileData(ctx, worldPool, character, PROFILE_TABS.SUMMARY);
    const buttons = buildProfileButtons(character.Id, PROFILE_TABS.SUMMARY);

    await interaction.editReply({
        ...view,
        components: [buttons],
    });
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

    const { view } = await buildProfileData(ctx, worldPool, character, PROFILE_TABS.SUMMARY);
    const buttons = buildProfileButtons(character.Id, PROFILE_TABS.SUMMARY);

    return interaction.editReply({
        ...view,
        components: [buttons],
    });
}

async function handlePerfilButton(interaction, ctx) {
    await interaction.deferUpdate();

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.editReply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            components: [],
        });
    }

    const parts = interaction.customId.split(':');
    const action = parts[1];
    const charId = Number.parseInt(parts[2], 10);

    if (!action || !Number.isFinite(charId)) {
        return interaction.editReply({
            content: '🔴 Acción inválida.',
            components: [],
        });
    }

    const character = await loadCharacterById(worldPool, charId);
    if (!character) {
        return interaction.editReply({
            content: '🔴 No encontré el personaje.',
            components: [],
        });
    }

    if (action === 'stats') {
        const alignmentLevel = await fetchAlignmentLevel(worldPool, character.Honor);
        const statsBlock = buildStatsBlock(character, alignmentLevel);
        const view = buildStatsView({
            character,
            level: Number(character.Level ?? 1),
            statsBlock,
        });
        return interaction.editReply(view);
    }

    if (action === 'summary') {
        const { view } = await buildProfileData(ctx, worldPool, character, PROFILE_TABS.SUMMARY);
        return interaction.editReply(view);
    }

    if (action === 'equip') {
        const equippedItems = await loadEquippedItems(worldPool, character.Id);
        const equipmentLines = buildEquipmentPreview(equippedItems);
        const equipmentBySlot = buildEquipmentBySlot(equippedItems);
        const equipmentImage = await buildEquipmentImageAttachment(equipmentBySlot);
        const components = [buildEquipmentActions(character.Id)];
        const view = buildEquipmentView({
            character,
            level: Number(character.Level ?? 1),
            equipmentLines,
            equipmentImage,
            components,
        });
        return interaction.editReply(view);
    }

    if (action === 'equipstats') {
        const equippedItems = await loadEquippedItems(worldPool, character.Id);
        const equipmentLines = buildEquipmentPreview(equippedItems);
        const equipmentBySlot = buildEquipmentBySlot(equippedItems);
        const equipmentImage = await buildEquipmentImageAttachment(equipmentBySlot);
        const options = buildEquippedSelectOptions(equippedItems);
        const selectRow = buildEquipmentStatsSelect(character.Id, options);
        const components = [selectRow, buildEquipmentActions(character.Id, { includeStats: false })];
        const view = buildEquipmentView({
            character,
            level: Number(character.Level ?? 1),
            equipmentLines,
            equipmentImage,
            components,
        });
        return interaction.editReply(view);
    }

    return interaction.editReply({
        content: '🔴 Acción no reconocida.',
        components: [],
    });
}

async function handleEquipmentSelect(interaction, ctx) {
    await interaction.deferUpdate();

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.editReply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            components: [],
        });
    }

    const parts = interaction.customId.split(':');
    const charId = Number.parseInt(parts[parts.length - 1], 10);
    if (!Number.isFinite(charId)) {
        return interaction.editReply({
            content: '🔴 Selección inválida.',
            components: [],
        });
    }

    const selection = interaction.values?.[0];
    if (selection === 'none') {
        const character = await loadCharacterById(worldPool, charId);
        if (!character) {
            return interaction.editReply({
                content: '🔴 Personaje no encontrado.',
                components: [],
            });
        }
        const equippedItems = await loadEquippedItems(worldPool, character.Id);
        const equipmentLines = buildEquipmentPreview(equippedItems);
        const equipmentBySlot = buildEquipmentBySlot(equippedItems);
        const equipmentImage = await buildEquipmentImageAttachment(equipmentBySlot);
        const components = [buildEquipmentActions(character.Id)];
        const view = buildEquipmentView({
            character,
            level: Number(character.Level ?? 1),
            equipmentLines,
            equipmentImage,
            components,
        });
        return interaction.editReply(view);
    }

    const slotId = Number.parseInt(selection, 10);
    if (!Number.isFinite(slotId)) {
        return interaction.editReply({
            content: '🔴 Selección inválida.',
            components: [],
        });
    }

    const character = await loadCharacterById(worldPool, charId);
    if (!character) {
        return interaction.editReply({
            content: '🔴 Personaje no encontrado.',
            components: [],
        });
    }

    const equippedItems = await loadEquippedItems(worldPool, character.Id);
    const item = equippedItems.find((entry) => Number(entry.Position) === slotId);
    if (!item) {
        return interaction.editReply({
            content: '🔴 Ese objeto ya no está equipado.',
            components: [],
        });
    }

    const slotName = EQUIPMENT_SLOTS[slotId] ?? `Pos ${slotId}`;
    const effects = parseSerializedEffects(item.SerializedEffects);
    const effectsLines = effects.length ? effects.map(formatEffect) : ['Sin efectos'];
    const iconPath = resolveEquipmentIconPath(item.ItemId);
    const iconAttachment = iconPath
        ? new AttachmentBuilder(iconPath, { name: `item-${item.ItemId}.png` })
        : null;
    const components = [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`perfil.btn:equip:${character.Id}`)
                .setLabel('⬅️ Equipamiento')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`perfil.btn:summary:${character.Id}`)
                .setLabel('🏠 Perfil')
                .setStyle(ButtonStyle.Secondary)
        ),
    ];
    const view = buildItemStatsView({
        character,
        item,
        slotName,
        effectsLines,
        iconAttachment,
        components,
    });
    return interaction.editReply(view);
}

async function handlePerfilSelect(interaction, ctx) {
    if (interaction.customId === SELECTS.ACCOUNT) {
        return handlePerfilAccountSelect(interaction, ctx);
    }
    if (interaction.customId.startsWith(`${SELECTS.CHARACTER}:`)) {
        return handlePerfilCharacterSelect(interaction, ctx);
    }
    if (interaction.customId.startsWith(`${SELECTS.EQUIPMENT}:`)) {
        return handleEquipmentSelect(interaction, ctx);
    }
    return interaction.reply({
        content: '🔴 Acción no reconocida.',
        ephemeral: true,
    });
}

async function handlePerfilTabButton(interaction, ctx) {
    await interaction.deferUpdate();

    const parts = interaction.customId.split(':');
    const tab = parts[1];
    const charId = Number.parseInt(parts[2], 10);

    if (!Object.values(PROFILE_TABS).includes(tab) || !Number.isFinite(charId)) {
        return interaction.editReply({
            content: '🔴 Acción no reconocida.',
            components: [],
        });
    }

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.editReply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            components: [],
        });
    }

    const character = await loadCharacterById(worldPool, charId);
    if (!character) {
        return interaction.editReply({
            content: '🔴 Personaje no encontrado.',
            components: [],
        });
    }

    const { view, extraComponents } = await buildProfileData(ctx, worldPool, character, tab);
    const buttons = buildProfileButtons(character.Id, tab);

    return interaction.editReply({
        ...view,
        components: [...(extraComponents ?? []), buttons],
    });
}

module.exports = { handlePerfilCommand, handlePerfilSelect, handlePerfilTabButton, handlePerfilButton };