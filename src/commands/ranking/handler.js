const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const { buildRankingEmbed, RANKING_LABELS } = require('./ui.js');

const IDS = {
    TAB: 'ranking:tab',
    LIMIT: 'ranking:limit',
    FILTER: 'ranking:filter',
};

const RANKING_TYPES = {
    LEVEL: 'level',
    PVP: 'pvp',
    GUILDS: 'guilds',
    ACHIEVEMENTS: 'achievements',
};

const LIMITS = [15, 25];

function formatNumber(value) {
    return new Intl.NumberFormat('es-ES').format(value ?? 0);
}

function formatPosition(index) {
    if (index === 1) return '🥇';
    if (index === 2) return '🥈';
    if (index === 3) return '🥉';
    return `#${index}`;
}

function parseFilterValue(raw) {
    const value = String(raw ?? 'global');
    if (value === 'global') {
        return { value: 'global', breedId: null };
    }
    if (value.startsWith('breed-')) {
        const id = Number.parseInt(value.replace('breed-', ''), 10);
        return Number.isFinite(id) ? { value, breedId: id } : { value: 'global', breedId: null };
    }
    return { value: 'global', breedId: null };
}

function getDefaultState() {
    return {
        type: RANKING_TYPES.LEVEL,
        limit: LIMITS[0],
        filter: 'global',
    };
}

function parseStateFromButton(customId) {
    const parts = String(customId).split(':');
    if (parts.length < 5) return getDefaultState();
    return {
        type: parts[2] || RANKING_TYPES.LEVEL,
        limit: Number.parseInt(parts[3], 10) || LIMITS[0],
        filter: parts[4] || 'global',
    };
}

function parseStateFromLimit(customId) {
    const parts = String(customId).split(':');
    if (parts.length < 5) return getDefaultState();
    return {
        type: parts[3] || RANKING_TYPES.LEVEL,
        limit: Number.parseInt(parts[2], 10) || LIMITS[0],
        filter: parts[4] || 'global',
    };
}

function buildTypeButtons(state) {
    const row = new ActionRowBuilder();
    const buttons = [
        { id: RANKING_TYPES.LEVEL, label: 'Nivel' },
        { id: RANKING_TYPES.PVP, label: 'PvP' },
        { id: RANKING_TYPES.GUILDS, label: 'Gremios' },
        { id: RANKING_TYPES.ACHIEVEMENTS, label: 'Logros' },
    ];

    buttons.forEach((button) => {
        const isActive = button.id === state.type;
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`${IDS.TAB}:${button.id}:${state.limit}:${state.filter}`)
                .setLabel(button.label)
                .setStyle(isActive ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(isActive)
        );
    });

    return row;
}

function buildLimitButtons(state) {
    const row = new ActionRowBuilder();

    const [first, second] = LIMITS;
    const nextLimit = state.limit === first ? second : first;

    row.addComponents(
        new ButtonBuilder()
            .setCustomId(`${IDS.LIMIT}:${nextLimit}:${state.type}:${state.filter}`)
            .setLabel(`🔁 Top ${nextLimit}`)
            .setStyle(ButtonStyle.Primary)
    );

    return row;
}

function buildFilterSelect(state, breeds) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(`${IDS.FILTER}:${state.type}:${state.limit}`)
        .setPlaceholder('Filtrar por clase');

    const options = [
        {
            label: 'Global (todas las clases)',
            value: 'global',
            default: state.filter === 'global',
        },
        ...breeds.map((breed) => ({
            label: breed.ShortName?.trim() || `Clase #${breed.Id}`,
            value: `breed-${breed.Id}`,
            default: state.filter === `breed-${breed.Id}`,
        })),
    ];

    select.addOptions(options);

    if (state.type === RANKING_TYPES.GUILDS) {
        select.setDisabled(true).setPlaceholder('Filtro no disponible para gremios');
    }

    return new ActionRowBuilder().addComponents(select);
}

async function loadBreeds(worldPool) {
    const [rows] = await worldPool.query(
        'SELECT Id, ShortName FROM breeds ORDER BY Id ASC;'
    );
    return rows ?? [];
}

async function loadRankingEntries(worldPool, type, limit, filter) {
    if (type === RANKING_TYPES.GUILDS) {
        const [rows] = await worldPool.query(
            `
            SELECT
                g.Id,
                g.Name,
                g.Experience,
                (
                    SELECT e.Level
                    FROM experiences e
                    WHERE e.GuildExp <= g.Experience
                    ORDER BY e.Level DESC
                    LIMIT 1
                ) AS Level
            FROM guilds g
            ORDER BY g.Experience DESC
            LIMIT ?;
            `,
            [limit]
        );
        return rows ?? [];
    }

    const filterClause = filter?.breedId ? 'AND c.Breed = ?' : '';
    const params = filter?.breedId ? [filter.breedId, limit] : [limit];

    if (type === RANKING_TYPES.PVP) {
        const [rows] = await worldPool.query(
            `
            SELECT
                c.Id,
                c.Name,
                c.Breed,
                c.Honor,
                (
                    SELECT e.Level
                    FROM experiences e
                    WHERE e.AlignmentHonor <= c.Honor
                    ORDER BY e.Level DESC
                    LIMIT 1
                ) AS AlignmentLevel,
                b.ShortName AS BreedName
            FROM characters c
            LEFT JOIN breeds b ON b.Id = c.Breed
            WHERE c.DeletedDate IS NULL
            ${filterClause}
            ORDER BY c.Honor DESC
            LIMIT ?;
            `,
            params
        );
        return rows ?? [];
    }

    if (type === RANKING_TYPES.ACHIEVEMENTS) {
        const [rows] = await worldPool.query(
            `
            SELECT
                c.Id,
                c.Name,
                c.Breed,
                c.AchievementPoints,
                b.ShortName AS BreedName
            FROM characters c
            LEFT JOIN breeds b ON b.Id = c.Breed
            WHERE c.DeletedDate IS NULL
            ${filterClause}
            ORDER BY c.AchievementPoints DESC
            LIMIT ?;
            `,
            params
        );
        return rows ?? [];
    }

    const [rows] = await worldPool.query(
        `
        SELECT
            c.Id,
            c.Name,
            c.Breed,
            c.Experience,
            b.ShortName AS BreedName,
            (
                SELECT e.Level
                FROM experiences e
                WHERE e.CharacterExp <= c.Experience
                ORDER BY e.Level DESC
                LIMIT 1
            ) AS Level
        FROM characters c
        LEFT JOIN breeds b ON b.Id = c.Breed
        WHERE c.DeletedDate IS NULL
        ${filterClause}
        ORDER BY c.Experience DESC
        LIMIT ?;
        `,
        params
    );
    return rows ?? [];
}

function buildRankingLines(type, entries) {
    return entries.map((entry, index) => {
        const position = formatPosition(index + 1);
        const spacing = `${position}  `;

        if (type === RANKING_TYPES.GUILDS) {
            const level = Number(entry.Level ?? 0);
            const name = entry.Name || '—';
            return `${spacing}${name} — Nivel ${formatNumber(level)}`;
        }

        const name = entry.Name || '—';
        const breedName = entry.BreedName?.trim() || 'Clase desconocida';

        if (type === RANKING_TYPES.PVP) {
            const alignmentLevel = Number(entry.AlignmentLevel ?? 0);
            return `${spacing}${name} — Honor ${formatNumber(entry.Honor)} · Alin. ${formatNumber(alignmentLevel)} · ${breedName}`;
        }

        if (type === RANKING_TYPES.ACHIEVEMENTS) {
            return `${spacing}${name} — Logros ${formatNumber(entry.AchievementPoints)} · ${breedName}`;
        }

        const level = Number(entry.Level ?? 0);

        return `${spacing}${name} — Lvl ${formatNumber(level)} · ${breedName}`;
    });
}

function resolveFilterLabel(state, breeds) {
    if (state.type === RANKING_TYPES.GUILDS) {
        return { scopeLabel: 'Global', classLabel: null };
    }

    if (state.filter === 'global') {
        return { scopeLabel: 'Global', classLabel: 'Todas las clases' };
    }

    const parsed = parseFilterValue(state.filter);
    if (parsed.breedId) {
        const breed = breeds.find((entry) => entry.Id === parsed.breedId);
        if (breed?.ShortName) {
            const labelClass = `Clase: ${breed.ShortName.trim()}`;
            return { scopeLabel: 'Global', classLabel: labelClass };
        }
    }

    return { scopeLabel: 'Global', classLabel: breed.ShortName };
}

async function buildRankingPayload(ctx, state) {
    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return {
            error: 'Configura primero la base de datos WORLD con `/instalar`.',
        };
    }

    const breeds = await loadBreeds(worldPool);
    const filter = parseFilterValue(state.filter);
    const entries = await loadRankingEntries(worldPool, state.type, state.limit, filter);
    const lines = buildRankingLines(state.type, entries);
    const filterLabel = resolveFilterLabel(state, breeds);

    const embed = buildRankingEmbed({
        type: state.type,
        limit: state.limit,
        filterLabel,
        lines,
    });

    const components = [
        buildTypeButtons(state),
        buildLimitButtons(state),
        buildFilterSelect(state, breeds),
    ];

    return { embed, components };
}

async function handleRankingCommand(interaction, ctx) {
    const state = getDefaultState();
    await interaction.deferReply();

    const { embed, components, error } = await buildRankingPayload(ctx, state);
    if (error) {
        return interaction.editReply({ content: error, embeds: [], components: [] });
    }

    return interaction.editReply({ embeds: [embed], components });
}

async function handleRankingButton(interaction, ctx) {
    await interaction.deferUpdate();

    let state = getDefaultState();
    if (interaction.customId.startsWith(IDS.TAB)) {
        state = parseStateFromButton(interaction.customId);
    } else if (interaction.customId.startsWith(IDS.LIMIT)) {
        state = parseStateFromLimit(interaction.customId);
    }

    if (!Object.values(RANKING_TYPES).includes(state.type)) {
        state.type = RANKING_TYPES.LEVEL;
    }

    if (!LIMITS.includes(state.limit)) {
        state.limit = LIMITS[0];
    }

    const { embed, components, error } = await buildRankingPayload(ctx, state);
    if (error) {
        return interaction.editReply({ content: error, embeds: [], components: [] });
    }

    return interaction.editReply({ embeds: [embed], components });
}

async function handleRankingSelect(interaction, ctx) {
    await interaction.deferUpdate();

    const parts = String(interaction.customId).split(':');
    const type = parts[2] || RANKING_TYPES.LEVEL;
    const limit = Number.parseInt(parts[3], 10) || LIMITS[0];
    const filter = interaction.values?.[0] || 'global';

    const state = {
        type,
        limit,
        filter,
    };

    const { embed, components, error } = await buildRankingPayload(ctx, state);
    if (error) {
        return interaction.editReply({ content: error, embeds: [], components: [] });
    }

    return interaction.editReply({ embeds: [embed], components });
}

module.exports = {
    handleRankingCommand,
    handleRankingButton,
    handleRankingSelect,
    RANKING_TYPES,
    IDS,
    RANKING_LABELS,
};