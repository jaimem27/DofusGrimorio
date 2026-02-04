const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js');
const { IDS } = require('./ui.js');

const VOTE_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const SELECTS = {
    REDEEM_ACCOUNT: 'social:redeem:account',
};
const MODALS = {
    REDEEM_CODE: 'social.modal:redeem',
};
const INPUTS = {
    REDEEM_CODE: 'social.input:redeem.code',
};

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

function parseItemIds(raw) {
    if (!raw) return [];
    return String(raw)
        .split(',')
        .map((entry) => Number.parseInt(entry.trim(), 10))
        .filter((entry) => Number.isFinite(entry) && entry > 0);
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
        `SELECT Id, PossibleEffectsBin FROM items_templates WHERE Id IN (${placeholders})`,
        itemIds
    );
    const [weaponRows] = await worldPool.query(
        `SELECT Id, PossibleEffectsBin FROM items_templates_weapons WHERE Id IN (${placeholders})`,
        itemIds
    );
    const map = new Map();
    [...templateRows, ...weaponRows].forEach((row) => {
        if (!map.has(row.Id)) {
            map.set(row.Id, row.PossibleEffectsBin ?? null);
        }
    });
    return map;
}

async function createBankItems(worldPool, accountId, itemIds, effectsMap) {
    const [rows] = await worldPool.query(
        'SELECT MAX(Id) AS maxId FROM accounts_items_bank'
    );
    let nextId = Number(rows?.[0]?.maxId) || 0;
    const inserts = [];

    itemIds.forEach((itemId) => {
        nextId += 1;
        inserts.push([
            accountId,
            nextId,
            itemId,
            1,
            effectsMap.get(itemId) ?? null,
        ]);
    });

    for (const row of inserts) {
        await worldPool.query(
            'INSERT INTO accounts_items_bank (OwnerAccountId, Id, ItemId, Stack, SerializedEffects) VALUES (?, ?, ?, ?, ?)',
            row
        );
    }

    return inserts.length;
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

    const redeem = await loadRedeemCode(authPool, code);
    if (!redeem) {
        return interaction.editReply('🔴 Código inválido o inexistente.');
    }

    const usedAttempts = Number(redeem.used_attempts);
    const maxAttempts = Number(redeem.max_attempts);

    if (usedAttempts === -1 && !redeem.expires_at) {
        return interaction.editReply('🔴 Este código no tiene fecha de expiración configurada.');
    }

    if (isExpired(redeem.expires_at)) {
        return interaction.editReply('🔴 Este código ya expiró.');
    }

    if (usedAttempts !== -1 && Number.isFinite(maxAttempts) && usedAttempts >= maxAttempts) {
        return interaction.editReply('🔴 Este código ya fue reclamado todas las veces posibles.');
    }

    const itemIds = parseItemIds(redeem.items);
    if (!itemIds.length) {
        return interaction.editReply('🔴 Este código no tiene items configurados.');
    }

    const effectsMap = await loadItemTemplates(worldPool, itemIds);
    const missingItems = itemIds.filter((id) => !effectsMap.has(id));
    if (missingItems.length) {
        return interaction.editReply(
            `🔴 No encontré plantillas para los items: ${missingItems.join(', ')}.`
        );
    }

    const granted = await createBankItems(worldPool, accountId, itemIds, effectsMap);

    if (usedAttempts !== -1) {
        await authPool.query(
            'UPDATE dg_redeem_codes SET used_attempts = used_attempts + 1 WHERE id = ?',
            [redeem.id]
        );
    }

    return interaction.editReply(
        `✅ Código canjeado. Se entregaron ${granted} item${granted === 1 ? '' : 's'} en el banco.`
    );
}

async function handleSocialButton(interaction, ctx) {
    if (interaction.customId === IDS.BTN_VOTE) {
        return handleVote(interaction, ctx);
    }
    if (interaction.customId === IDS.BTN_REDEEM) {
        return handleRedeem(interaction, ctx);
    }
    return undefined;
}

async function handleSocialSelect(interaction, ctx) {
    if (interaction.customId === SELECTS.REDEEM_ACCOUNT) {
        return handleRedeemAccountSelect(interaction, ctx);
    }
    return undefined;
}

async function handleSocialModal(interaction, ctx) {
    if (interaction.customId.startsWith(MODALS.REDEEM_CODE)) {
        return handleRedeemModal(interaction, ctx);
    }
    return undefined;
}

module.exports = { handleSocialButton, handleSocialSelect, handleSocialModal };