const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { IDS } = require('./ui.js');

const VOTE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const BASE_JOB_ID = 1;
const SELECTS = {
    REDEEM_ACCOUNT: 'social:redeem:account',
    JOBS: 'social:jobs:select',
};
const MODALS = {
    REDEEM_CODE: 'social.modal:redeem',
    JOBS: 'social.modal:jobs',
};
const INPUTS = {
    REDEEM_CODE: 'social.input:redeem.code',
    JOB_MIN: 'social.input:jobs.min',
    JOB_MAX: 'social.input:jobs.max',
};

const JOB_ACTIONS = {
    TOGGLE_ONLINE: 'toggle_online',
    CHANGE_FILTERS: 'change_filters',
    CHANGE_JOB: 'change_job',
};
const JOB_GROUPS = [
    {
        emoji: '🌾',
        jobs: ['cazador', 'lenador', 'campesino', 'pescador', 'minero'],
    },
    {
        emoji: '🧪',
        jobs: ['joyeromago', 'sastremago', 'zapateromago', 'fabricamago', 'escultomago', 'forjamago'],
    },
    {
        emoji: '🔨',
        jobs: ['sastre', 'joyero', 'zapatero', 'herrero', 'alquimista', 'escultor', 'fabricante', 'manitas'],
    },
];
const DEFAULT_MAX_LEVEL = 200;
const DEFAULT_ACTIVE_MINUTES = 5;

function getVoteReward() {
    const reward = Number.parseInt(process.env.VOTE_TOKEN_REWARD || '20', 10);
    return Number.isFinite(reward) && reward > 0 ? reward : 20;
}

function formatRemaining(ms) {
    const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    }
    if (hours > 0) {
        return `${hours}h`;
    }
    return `${minutes}m`;
}

async function loadVoteAccount(authPool, discordUserId) {
    const [rows] = await authPool.query(
        `
        SELECT account_id, last_vote
        FROM dg_discord_account
        WHERE discord_user_id = ?
        ORDER BY linked_at ASC
        LIMIT 1
        `,
        [discordUserId]
    );
    return rows?.[0] ?? null;
}

async function loadLinkedAccounts(authPool, discordUserId) {
    if (!authPool) return [];
    const [rows] = await authPool.query(
        `
        SELECT a.Id, a.Login, a.Nickname
        FROM accounts a
        INNER JOIN dg_discord_account d ON d.account_id = a.Id
        WHERE d.discord_user_id = ?
        ORDER BY a.Id ASC
        `,
        [discordUserId]
    );
    return rows ?? [];
}

function buildRedeemAccountSelect(options) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECTS.REDEEM_ACCOUNT)
        .setPlaceholder('Elige la cuenta')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

function buildRedeemCodeModal(accountId) {
    const codeInput = new TextInputBuilder()
        .setCustomId(INPUTS.REDEEM_CODE)
        .setLabel('Código de recompensa')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('Ej: Inquisition-2024');

    return new ModalBuilder()
        .setCustomId(`${MODALS.REDEEM_CODE}:${accountId}`)
        .setTitle('Reclamar código')
        .addComponents(new ActionRowBuilder().addComponents(codeInput));
}

function normalizeCode(value) {
    return String(value ?? '').trim();
}

function parseItemEntries(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
            const [rawId, rawQty] = entry.split(';').map((value) => value.trim());
            const id = Number.parseInt(rawId, 10);
            const quantity = rawQty ? Number.parseInt(rawQty, 10) : 1;
            if (!Number.isFinite(id) || id <= 0) return null;
            if (!Number.isFinite(quantity) || quantity <= 0) return null;
            return { id, quantity };
        })
        .filter(Boolean);
}

function normalizeJobName(name) {
    return String(name ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');
}

function getJobEmoji(jobName) {
    const normalized = normalizeJobName(jobName);
    const group = JOB_GROUPS.find((entry) => entry.jobs.includes(normalized));
    return group?.emoji ?? '';
}

function formatJobOptionLabel(job) {
    const name = job.Name?.trim() || `Oficio #${job.Id}`;
    const emoji = getJobEmoji(name);
    return emoji ? `${emoji} ${name}` : name;
}

async function loadJobTemplates(worldPool) {
    const [rows] = await worldPool.query(
        `
        SELECT Id, Name
        FROM jobs_templates
        WHERE Id <> ?
        ORDER BY Name ASC
        `,
        [BASE_JOB_ID]
    );
    return rows ?? [];
}

async function loadJobTemplate(worldPool, jobId) {
    if (Number(jobId) === BASE_JOB_ID) {
        return null;
    }
    const [rows] = await worldPool.query(
        `
        SELECT Id, Name
        FROM jobs_templates
        WHERE Id = ?
        AND Id <> ?
        LIMIT 1
        `,
        [jobId, BASE_JOB_ID]
    );
    return rows?.[0] ?? null;
}

function buildJobsSelect(options) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECTS.JOBS)
        .setPlaceholder('Elige un oficio')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

function buildJobsModal(state, jobName) {
    const minInput = new TextInputBuilder()
        .setCustomId(INPUTS.JOB_MIN)
        .setLabel('Nivel mínimo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('1–200');

    const maxInput = new TextInputBuilder()
        .setCustomId(INPUTS.JOB_MAX)
        .setLabel('Nivel máximo')
        .setStyle(TextInputStyle.Short)
        .setRequired(false)
        .setPlaceholder(String(DEFAULT_MAX_LEVEL));

    if (state?.minLevel) {
        minInput.setValue(String(state.minLevel));
    }
    if (Number.isFinite(state?.maxLevel)) {
        maxInput.setValue(String(state.maxLevel));
    }

    return new ModalBuilder()
        .setCustomId(`${MODALS.JOBS}:${serializeJobState(state)}`)
        .setTitle(`Filtros — ${jobName}`)
        .addComponents(
            new ActionRowBuilder().addComponents(minInput),
            new ActionRowBuilder().addComponents(maxInput)
        );
}

function serializeJobState(state) {
    const safeState = state || {};
    const jobId = safeState.jobId ?? 0;
    const minLevel = safeState.minLevel ?? 0;
    const maxLevel = safeState.maxLevel ?? DEFAULT_MAX_LEVEL;
    const onlyOnline = safeState.onlyOnline ? 1 : 0;
    return `${jobId}:${minLevel}:${maxLevel}:${onlyOnline}`;
}

function parseJobState(parts) {
    const [jobId, minLevel, maxLevel, onlyOnline] = parts.map((value) =>
        Number.parseInt(value, 10)
    );
    return {
        jobId: Number.isFinite(jobId) ? jobId : null,
        minLevel: Number.isFinite(minLevel) ? minLevel : null,
        maxLevel: Number.isFinite(maxLevel) ? maxLevel : DEFAULT_MAX_LEVEL,
        onlyOnline: onlyOnline === 1,
    };
}

function parseLevelInput(raw, fallback = null) {
    const value = Number.parseInt(String(raw ?? '').trim(), 10);
    if (!Number.isFinite(value)) return fallback;
    return value;
}

function clampLevel(value) {
    if (!Number.isFinite(value)) return null;
    return Math.min(200, Math.max(1, value));
}

function resolveActiveMinutes() {
    const windowMinutes = Number.parseInt(process.env.PRESENCE_ACTIVE_MINUTES || '', 10);
    return Number.isFinite(windowMinutes) && windowMinutes > 0
        ? windowMinutes
        : DEFAULT_ACTIVE_MINUTES;
}

function isCharacterOnline(row, activeMinutes) {
    if (!row?.ConnectedCharacter) return false;
    if (Number(row.ConnectedCharacter) !== Number(row.CharacterId)) return false;
    if (row.MerchantCharacter) return false;
    const last = new Date(row.LastConnection);
    if (!Number.isFinite(last.getTime())) return false;
    const elapsed = Date.now() - last.getTime();
    return elapsed <= activeMinutes * 60 * 1000;
}

async function loadJobCrafters(worldPool, jobId, minLevel, maxLevel, onlyOnline) {
    const activeMinutes = resolveActiveMinutes();
    const onlineClause = onlyOnline
        ? `
          AND a.ConnectedCharacter = c.Id
          AND a.LastConnection > DATE_SUB(NOW(), INTERVAL ? MINUTE)
          AND wmm.CharacterId IS NULL
        `
        : '';
    const params = [jobId];
    if (onlyOnline) params.push(activeMinutes);
    params.push(minLevel, maxLevel);

    const [rows] = await worldPool.query(
        `
        SELECT
          c.Id AS CharacterId,
          c.Name AS CharacterName,
          c.AccountId,
          j.Name AS JobName,
          (SELECT e.Level
           FROM experiences e
           WHERE e.JobExp <= cj.Experience
           ORDER BY e.Level DESC
           LIMIT 1) AS JobLevel,
          a.ConnectedCharacter,
          a.LastConnection,
          wmm.CharacterId AS MerchantCharacter
        FROM characters_jobs cj
        INNER JOIN characters c ON c.Id = cj.CharacterId AND c.DeletedDate IS NULL 
        LEFT JOIN jobs_templates j ON j.Id = cj.TemplateId
        LEFT JOIN accounts a ON a.Id = c.AccountId
        LEFT JOIN world_maps_merchant wmm
          ON wmm.CharacterId = c.Id
          AND wmm.AccountId = c.AccountId
          AND wmm.IsActive = 1
        WHERE cj.TemplateId = ?
        ${onlineClause}
        HAVING JobLevel BETWEEN ? AND ?
        ORDER BY JobLevel DESC, c.Name ASC
        LIMIT 21;
        `,
        params
    );

    const results = rows ?? [];
    if (!onlyOnline) {
        return results.map((row) => ({
            ...row,
            IsOnline: isCharacterOnline(row, activeMinutes),
        }));
    }
    return results.map((row) => ({ ...row, IsOnline: true }));
}

function buildCrafterLines(results, jobName) {
    if (!results.length) return ['No se encontraron jugadores con ese rango.'];
    return results.map((row) => {
        const level = Number.isFinite(Number(row.JobLevel)) ? Number(row.JobLevel) : '—';
        return `• ${row.CharacterName || 'Jugador'} — ${jobName} ${level}`;
    });
}

function buildJobsResultsEmbed(jobName, minLevel, maxLevel, lines, moreCount) {
    const title = `🔨 Resultados — ${jobName} (min ${minLevel}, max ${maxLevel})`;
    const description = moreCount
        ? `${lines.join('\n')}\n\n… y más resultados.`
        : lines.join('\n');
    return new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setColor(0x2f3136);
}

function buildJobsResultButtons(state) {
    const toggleOnline = new ButtonBuilder()
        .setCustomId(`social:jobs:action:${JOB_ACTIONS.TOGGLE_ONLINE}:${serializeJobState(state)}`)
        .setLabel(`Solo conectados: ${state.onlyOnline ? 'ON' : 'OFF'}`)
        .setEmoji('🟢')
        .setStyle(state.onlyOnline ? ButtonStyle.Success : ButtonStyle.Secondary);

    const changeFilters = new ButtonBuilder()
        .setCustomId(`social:jobs:action:${JOB_ACTIONS.CHANGE_FILTERS}:${serializeJobState(state)}`)
        .setLabel('Cambiar filtros')
        .setEmoji('🔁')
        .setStyle(ButtonStyle.Primary);

    const changeJob = new ButtonBuilder()
        .setCustomId(`social:jobs:action:${JOB_ACTIONS.CHANGE_JOB}:${serializeJobState(state)}`)
        .setLabel('Cambiar oficio')
        .setEmoji('🛠️')
        .setStyle(ButtonStyle.Secondary);

    return new ActionRowBuilder().addComponents(toggleOnline, changeFilters, changeJob);
}

async function loadRedeemCode(authPool, code) {
    const [rows] = await authPool.query(
        `
        SELECT id, code, max_attempts, used_attempts, expires_at, items
        FROM dg_redeem_codes
        WHERE code = ?
        LIMIT 1
        `,
        [code]
    );
    return rows?.[0] ?? null;
}

function isExpired(expiresAt) {
    if (!expiresAt) return false;
    const expiresDate = new Date(expiresAt);
    if (!Number.isFinite(expiresDate.getTime())) return false;
    return Date.now() > expiresDate.getTime();
}

async function loadItemTemplates(worldPool, itemIds) {
    if (!itemIds.length) return new Map();
    const placeholders = itemIds.map(() => '?').join(',');
    const [templateRows] = await worldPool.query(
        `SELECT Id, PossibleEffectsBin, Name FROM items_templates WHERE Id IN (${placeholders})`,
        itemIds
    );
    const [weaponRows] = await worldPool.query(
        `SELECT Id, PossibleEffectsBin, Name FROM items_templates_weapons WHERE Id IN (${placeholders})`,
        itemIds
    );
    const map = new Map();
    [...templateRows, ...weaponRows].forEach((row) => {
        const current = map.get(row.Id);
        const entry = {
            effects: row.PossibleEffectsBin ?? null,
            name: row.Name ?? null,
        };
        if (!current || (!current.name && entry.name)) {
            map.set(row.Id, entry);
        }
    });
    return map;
}

async function createBankItems(worldPool, accountId, itemEntries, templateMap) {
    const [rows] = await worldPool.query(
        'SELECT MAX(Id) AS maxId FROM accounts_items_bank'
    );
    let nextId = Number(rows?.[0]?.maxId) || 0;
    const inserts = [];
    const granted = [];

    itemEntries.forEach(({ id, quantity }) => {
        nextId += 1;
        inserts.push([
            accountId,
            nextId,
            id,
            quantity,
            templateMap.get(id)?.effects ?? null,
        ]);
        granted.push({
            id,
            quantity,
            name: templateMap.get(id)?.name ?? null,
        });
    });

    for (const row of inserts) {
        await worldPool.query(
            'INSERT INTO accounts_items_bank (OwnerAccountId, Id, ItemId, Stack, SerializedEffects) VALUES (?, ?, ?, ?, ?)',
            row
        );
    }

    return granted;
}

async function hasRedeemedCode(authPool, redeemId, accountId) {
    const [rows] = await authPool.query(
        `SELECT 1 FROM dg_redeem_claims WHERE redeem_code_id = ? AND account_id = ? LIMIT 1`,
        [redeemId, accountId]
    );
    return rows.length > 0;
}

async function handleVote(interaction, ctx) {
    await interaction.deferReply({ ephemeral: true });

    const authPool = await ctx.db.getPool('auth');
    if (!authPool) {
        return interaction.editReply(
            'No hay conexión activa con las bases de datos. Inténtalo más tarde.'
        );
    }

    const discordUserId = interaction.user.id;
    const voteAccount = await loadVoteAccount(authPool, discordUserId);
    if (!voteAccount) {
        return interaction.editReply(
            'No tienes cuentas vinculadas. Vincula una antes de votar.'
        );
    }

    if (voteAccount.last_vote) {
        const lastVote = new Date(voteAccount.last_vote);
        if (Number.isFinite(lastVote.getTime())) {
            const elapsed = Date.now() - lastVote.getTime();
            if (elapsed < VOTE_COOLDOWN_MS) {
                const remaining = formatRemaining(VOTE_COOLDOWN_MS - elapsed);
                return interaction.editReply(
                    `Ya votaste recientemente. Podrás votar de nuevo en ${remaining}.`
                );
            }
        }
    }

    const accountId = voteAccount.account_id;
    const reward = getVoteReward();
    await authPool.query(
        `UPDATE accounts SET Tokens = Tokens + ? WHERE Id = ?`,
        [reward, accountId]
    );
    await authPool.query(
        `UPDATE dg_discord_account SET last_vote = NOW() WHERE discord_user_id = ? AND account_id = ?`,
        [discordUserId, accountId]
    );

    return interaction.editReply(
        `✅ ¡Voto registrado! Recibiste ${reward} token${reward === 1 ? '' : 's'}.`
    );
}

async function handleRedeem(interaction, ctx) {
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

    const selectRow = buildRedeemAccountSelect(options);

    return interaction.reply({
        ephemeral: true,
        content: '🎁 **Reclamar código**\nElige la cuenta en la que quieres recibir los items:',
        components: [selectRow],
    });
}

async function handleRedeemAccountSelect(interaction, ctx) {
    const authPool = await ctx.db.getPool('auth');
    if (!authPool) {
        return interaction.reply({
            ephemeral: true,
            content: 'Configura primero la base de datos AUTH con `/instalar`.',
        });
    }

    const accountId = Number.parseInt(interaction.values?.[0], 10);
    if (!Number.isFinite(accountId)) {
        return interaction.reply({
            ephemeral: true,
            content: '🔴 Selección inválida.',
        });
    }

    const [rows] = await authPool.query(
        `SELECT 1 FROM dg_discord_account WHERE discord_user_id = ? AND account_id = ? LIMIT 1`,
        [interaction.user.id, accountId]
    );
    if (!rows.length) {
        return interaction.reply({
            ephemeral: true,
            content: '🔴 Acceso denegado.',
        });
    }

    const modal = buildRedeemCodeModal(accountId);
    return interaction.showModal(modal);
}

async function handleRedeemModal(interaction, ctx) {
    await interaction.deferReply({ ephemeral: true });

    const rawCode = interaction.fields.getTextInputValue(INPUTS.REDEEM_CODE);
    const code = normalizeCode(rawCode);
    if (!code) {
        return interaction.editReply('🔴 Ingresa un código válido.');
    }

    const authPool = await ctx.db.getPool('auth');
    const worldPool = await ctx.db.getPool('world');
    if (!authPool || !worldPool) {
        return interaction.editReply(
            'Configura primero las bases de datos AUTH y WORLD con `/instalar`.'
        );
    }

    const parts = interaction.customId.split(':');
    const accountId = Number.parseInt(parts[parts.length - 1], 10);
    if (!Number.isFinite(accountId)) {
        return interaction.editReply('🔴 Cuenta inválida.');
    }

    const [allowedRows] = await authPool.query(
        `SELECT 1 FROM dg_discord_account WHERE discord_user_id = ? AND account_id = ? LIMIT 1`,
        [interaction.user.id, accountId]
    );
    if (!allowedRows.length) {
        return interaction.editReply('🔴 Acceso denegado.');
    }

    const [worldAccountRows] = await worldPool.query(
        'SELECT Id FROM accounts WHERE Id = ? LIMIT 1',
        [accountId]
    );
    if (!worldAccountRows.length) {
        return interaction.editReply('🔴 No encontré esa cuenta en WORLD.');
    }

    const redeem = await loadRedeemCode(authPool, code);
    if (!redeem) {
        return interaction.editReply('🔴 Código inválido o inexistente.');
    }

    const usedAttempts = Number(redeem.used_attempts);
    const maxAttempts = Number(redeem.max_attempts);

    if (isExpired(redeem.expires_at)) {
        return interaction.editReply('🔴 Este código ya expiró.');
    }

    if (maxAttempts !== -1 && Number.isFinite(maxAttempts) && usedAttempts >= maxAttempts) {
        return interaction.editReply('🔴 Este código ya fue reclamado todas las veces posibles.');
    }

    if (await hasRedeemedCode(authPool, redeem.id, accountId)) {
        return interaction.editReply('🔴 Esta cuenta ya reclamó este código anteriormente.');
    }

    const itemEntries = parseItemEntries(redeem.items);
    if (!itemEntries.length) {
        return interaction.editReply('🔴 Este código no tiene items configurados.');
    }

    const itemIds = itemEntries.map((entry) => entry.id);
    const templateMap = await loadItemTemplates(worldPool, itemIds);
    const missingItems = itemIds.filter((id) => !templateMap.has(id));
    if (missingItems.length) {
        return interaction.editReply(
            `🔴 No encontré plantillas para los items: ${missingItems.join(', ')}.`
        );
    }

    const granted = await createBankItems(worldPool, accountId, itemEntries, templateMap);

    if (maxAttempts !== -1 && usedAttempts !== -1) {
        await authPool.query(
            'UPDATE dg_redeem_codes SET used_attempts = used_attempts + 1 WHERE id = ?',
            [redeem.id]
        );
    }

    await authPool.query(
        'INSERT INTO dg_redeem_claims (redeem_code_id, account_id) VALUES (?, ?)',
        [redeem.id, accountId]
    );

    const itemLines = granted.map((item) => {
        const name = item.name?.trim() || `Item #${item.id}`;
        return `• ${name} x${item.quantity}`;
    });

    return interaction.editReply(
        `✅ Código canjeado. Recibiste:\n${itemLines.join('\n')}`
    );
}

async function handleJobsButton(interaction, ctx) {
    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.reply({
            ephemeral: true,
            content: 'Configura primero la base de datos WORLD con `/instalar`.',
        });
    }

    const jobs = await loadJobTemplates(worldPool);
    if (!jobs.length) {
        return interaction.reply({
            ephemeral: true,
            content: 'No encontré oficios en la base de datos.',
        });
    }

    const options = jobs.map((job) => ({
        label: formatJobOptionLabel(job),
        value: String(job.Id),
    }));

    const selectRow = buildJobsSelect(options);
    return interaction.reply({
        ephemeral: true,
        content: '🔎 **Buscar crafteador**\nElige el oficio que necesitas:',
        components: [selectRow],
    });
}

async function handleJobsSelect(interaction, ctx) {
    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.reply({
            ephemeral: true,
            content: 'Configura primero la base de datos WORLD con `/instalar`.',
        });
    }

    const jobId = Number.parseInt(interaction.values?.[0], 10);
    if (!Number.isFinite(jobId) || jobId === BASE_JOB_ID) {
        return interaction.reply({
            ephemeral: true,
            content: 'Selección inválida.',
        });
    }

    const job = await loadJobTemplate(worldPool, jobId);
    const jobName = job?.Name?.trim() || `Oficio #${jobId}`;
    const modal = buildJobsModal(
        {
            jobId,
            minLevel: null,
            maxLevel: DEFAULT_MAX_LEVEL,
            onlyOnline: false,
        },
        jobName
    );
    return interaction.showModal(modal);
}

async function handleJobsModal(interaction, ctx) {
    await interaction.deferReply({ ephemeral: true });
    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.editReply(
            'Configura primero la base de datos WORLD con `/instalar`.'
        );
    }

    const stateParts = interaction.customId.split(':').slice(2);
    const state = parseJobState(stateParts);
    if (!Number.isFinite(state.jobId) || state.jobId === BASE_JOB_ID) {
        return interaction.editReply('Oficio inválido.');
    }

    const minRaw = interaction.fields.getTextInputValue(INPUTS.JOB_MIN);
    const maxRaw = interaction.fields.getTextInputValue(INPUTS.JOB_MAX);
    const minLevel = clampLevel(parseLevelInput(minRaw));
    const maxLevel = clampLevel(parseLevelInput(maxRaw, DEFAULT_MAX_LEVEL));

    if (!Number.isFinite(minLevel)) {
        return interaction.editReply('🔴 Ingresa un nivel mínimo válido.');
    }
    if (!Number.isFinite(maxLevel)) {
        return interaction.editReply('🔴 Ingresa un nivel máximo válido.');
    }
    if (minLevel > maxLevel) {
        return interaction.editReply('🔴 El nivel mínimo no puede ser mayor al máximo.');
    }

    const job = await loadJobTemplate(worldPool, state.jobId);
    const jobName = job?.Name?.trim() || `Oficio #${state.jobId}`;

    const nextState = {
        jobId: state.jobId,
        minLevel,
        maxLevel,
        onlyOnline: state.onlyOnline,
    };

    const results = await loadJobCrafters(
        worldPool,
        state.jobId,
        minLevel,
        maxLevel,
        state.onlyOnline
    );

    const trimmed = results.slice(0, 20);
    const hasMore = results.length > 20;
    const lines = buildCrafterLines(trimmed, jobName);
    const embed = buildJobsResultsEmbed(jobName, minLevel, maxLevel, lines, hasMore);
    const buttons = buildJobsResultButtons(nextState);

    return interaction.editReply({
        embeds: [embed],
        components: [buttons],
        allowedMentions: { parse: [] },
    });
}

async function handleJobsAction(interaction, ctx) {
    const parts = interaction.customId.split(':');
    const action = parts[3];
    const state = parseJobState(parts.slice(4));
    if (!Number.isFinite(state.jobId) || state.jobId === BASE_JOB_ID) {
        return interaction.reply({ ephemeral: true, content: 'Oficio inválido.' });
    }

    if (action === JOB_ACTIONS.CHANGE_JOB) {
        const worldPool = await ctx.db.getPool('world');
        if (!worldPool) {
            return interaction.reply({
                ephemeral: true,
                content: 'Configura primero la base de datos WORLD con `/instalar`.',
            });
        }

        const jobs = await loadJobTemplates(worldPool);
        const options = jobs.map((job) => ({
            label: formatJobOptionLabel(job),
            value: String(job.Id),
        }));
        const selectRow = buildJobsSelect(options);
        return interaction.update({
            content: '🔎 **Buscar crafteador**\nElige el oficio que necesitas:',
            embeds: [],
            components: [selectRow],
            allowedMentions: { parse: [] },
        });
    }

    if (action === JOB_ACTIONS.CHANGE_FILTERS) {
        const worldPool = await ctx.db.getPool('world');
        if (!worldPool) {
            return interaction.reply({
                ephemeral: true,
                content: 'Configura primero la base de datos WORLD con `/instalar`.',
            });
        }

        const job = await loadJobTemplate(worldPool, state.jobId);
        const jobName = job?.Name?.trim() || `Oficio #${state.jobId}`;
        const modal = buildJobsModal(state, jobName);
        return interaction.showModal(modal);
    }

    const worldPool = await ctx.db.getPool('world');
    if (!worldPool) {
        return interaction.reply({
            ephemeral: true,
            content: 'Configura primero la base de datos WORLD con `/instalar`.',
        });
    }

    const nextState = {
        ...state,
        onlyOnline:
            action === JOB_ACTIONS.TOGGLE_ONLINE ? !state.onlyOnline : state.onlyOnline,
    };

    const job = await loadJobTemplate(worldPool, nextState.jobId);
    const jobName = job?.Name?.trim() || `Oficio #${nextState.jobId}`;
    const results = await loadJobCrafters(
        worldPool,
        nextState.jobId,
        nextState.minLevel,
        nextState.maxLevel,
        nextState.onlyOnline
    );
    const trimmed = results.slice(0, 20);
    const hasMore = results.length > 20;
    const lines = buildCrafterLines(trimmed, jobName);
    const embed = buildJobsResultsEmbed(
        jobName,
        nextState.minLevel,
        nextState.maxLevel,
        lines,
        hasMore
    );
    const buttons = buildJobsResultButtons(nextState);

    return interaction.update({
        embeds: [embed],
        components: [buttons],
        allowedMentions: { parse: [] },
    });
}

async function handleSocialButton(interaction, ctx) {
    if (interaction.customId === IDS.BTN_VOTE) {
        return handleVote(interaction, ctx);
    }
    if (interaction.customId === IDS.BTN_REDEEM) {
        return handleRedeem(interaction, ctx);
    }
    if (interaction.customId === IDS.BTN_JOBS) {
        return handleJobsButton(interaction, ctx);
    }
    if (interaction.customId.startsWith('social:jobs:action:')) {
        return handleJobsAction(interaction, ctx);
    }
    return undefined;
}

async function handleSocialSelect(interaction, ctx) {
    if (interaction.customId === SELECTS.REDEEM_ACCOUNT) {
        return handleRedeemAccountSelect(interaction, ctx);
    }
    if (interaction.customId === SELECTS.JOBS) {
        return handleJobsSelect(interaction, ctx);
    }
    return undefined;
}

async function handleSocialModal(interaction, ctx) {
    if (interaction.customId.startsWith(MODALS.REDEEM_CODE)) {
        return handleRedeemModal(interaction, ctx);
    }
    if (interaction.customId.startsWith(MODALS.JOBS)) {
        return handleJobsModal(interaction, ctx);
    }
    return undefined;
}

module.exports = { handleSocialButton, handleSocialSelect, handleSocialModal };