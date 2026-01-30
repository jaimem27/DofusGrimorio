const crypto = require('crypto');
const {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');
const { buildAccountsView } = require('./ui.js');

const MODALS = {
    CREATE_STEP1: 'acc.modal:create.1',
    CREATE_STEP2: 'acc.modal:create.2',
    PASS_UPDATE: 'acc.modal:pass',
};

const SELECTS = {
    PASS_ACCOUNT: 'acc:pass:select',
};

const INPUTS = {
    QTY: 'acc.in:qty',
    LOGIN: 'acc.in:login',
    NICK: 'acc.in:nick',
    PASS: 'acc.in:pass',
    PASS_NEW: 'acc.in:pass.new',
    EMAIL: 'acc.in:email',
    SECRET_Q: 'acc.in:sq',
    SECRET_A: 'acc.in:sa',
    SECRET_VERIFY: 'acc.in:sa.verify',
};

const DRAFT_TTL_SECONDS = 90;
const MAX_ACCOUNTS = 8;

function buildCreateModalStep1() {
    const qty = new TextInputBuilder()
        .setCustomId(INPUTS.QTY)
        .setLabel('Número de cuentas (1–8)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder('1');

    const login = new TextInputBuilder()
        .setCustomId(INPUTS.LOGIN)
        .setLabel('Usuario')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const nick = new TextInputBuilder()
        .setCustomId(INPUTS.NICK)
        .setLabel('Apodo')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const pass = new TextInputBuilder()
        .setCustomId(INPUTS.PASS)
        .setLabel('Contraseña')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const email = new TextInputBuilder()
        .setCustomId(INPUTS.EMAIL)
        .setLabel('Email (opcional)')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

    return new ModalBuilder()
        .setCustomId(MODALS.CREATE_STEP1)
        .setTitle('Crear cuenta(s) - Paso 1/2')
        .addComponents(
            new ActionRowBuilder().addComponents(qty),
            new ActionRowBuilder().addComponents(login),
            new ActionRowBuilder().addComponents(nick),
            new ActionRowBuilder().addComponents(pass),
            new ActionRowBuilder().addComponents(email)
        );
}

function buildCreateModalStep2() {
    const secretQ = new TextInputBuilder()
        .setCustomId(INPUTS.SECRET_Q)
        .setLabel('Pregunta secreta')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const secretA = new TextInputBuilder()
        .setCustomId(INPUTS.SECRET_A)
        .setLabel('Respuesta secreta')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    return new ModalBuilder()
        .setCustomId(MODALS.CREATE_STEP2)
        .setTitle('Crear cuenta(s) - Paso 2/2')
        .addComponents(
            new ActionRowBuilder().addComponents(secretQ),
            new ActionRowBuilder().addComponents(secretA)
        );
}

function buildPassSelect(options) {
    const select = new StringSelectMenuBuilder()
        .setCustomId(SELECTS.PASS_ACCOUNT)
        .setPlaceholder('Elige cuenta')
        .addOptions(options);

    return new ActionRowBuilder().addComponents(select);
}

function buildPasswordModal(account) {
    const newPass = new TextInputBuilder()
        .setCustomId(INPUTS.PASS_NEW)
        .setLabel('Nueva contraseña')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    const secretQ = new TextInputBuilder()
        .setCustomId(INPUTS.SECRET_Q)
        .setLabel('Pregunta secreta')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(account.SecretQuestion || '');

    const secretA = new TextInputBuilder()
        .setCustomId(INPUTS.SECRET_A)
        .setLabel('Respuesta secreta')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setValue(account.SecretAnswer || '');

    const secretVerify = new TextInputBuilder()
        .setCustomId(INPUTS.SECRET_VERIFY)
        .setLabel('Confirma la respuesta secreta')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    return new ModalBuilder()
        .setCustomId(`${MODALS.PASS_UPDATE}:${account.Id}`)
        .setTitle('Cambiar contraseña')
        .addComponents(
            new ActionRowBuilder().addComponents(newPass),
            new ActionRowBuilder().addComponents(secretQ),
            new ActionRowBuilder().addComponents(secretA),
            new ActionRowBuilder().addComponents(secretVerify)
        );
}

function parseQty(raw) {
    const qty = Number.parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(qty)) return null;
    if (qty < 1 || qty > MAX_ACCOUNTS) return null;
    return qty;
}

function normalizeInput(value) {
    return String(value ?? '').trim();
}

async function loadLinkedAccounts(pool, discordUserId) {
    const [rows] = await pool.query(
        `SELECT a.Id, a.Login, a.Nickname
         FROM accounts a
         INNER JOIN dg_discord_account d ON d.account_id = a.Id
         WHERE d.discord_user_id = ?
         ORDER BY a.Login ASC`,
        [discordUserId]
    );

    return rows;
}

async function loadAccountForUser(pool, discordUserId, accountId) {
    const [rows] = await pool.query(
        `SELECT a.Id, a.Login, a.Nickname, a.SecretQuestion, a.SecretAnswer
         FROM accounts a
         INNER JOIN dg_discord_account d ON d.account_id = a.Id
         WHERE d.discord_user_id = ? AND a.Id = ?
         LIMIT 1`,
        [discordUserId, accountId]
    );

    return rows[0] || null;
}

async function saveDraft(pool, discordUserId, payload) {
    await pool.query(
        'REPLACE INTO dg_create_draft (discord_user_id, payload, created_at) VALUES (?, ?, NOW())',
        [discordUserId, JSON.stringify(payload)]
    );
}

async function loadDraft(pool, discordUserId) {
    const [rows] = await pool.query(
        `SELECT payload FROM dg_create_draft
         WHERE discord_user_id = ? AND created_at >= (NOW() - INTERVAL ? SECOND)
         LIMIT 1`,
        [discordUserId, DRAFT_TTL_SECONDS]
    );
    if (!rows.length) return null;
    try {
        return JSON.parse(rows[0].payload);
    } catch (_) {
        return null;
    }
}

async function deleteDraft(pool, discordUserId) {
    await pool.query('DELETE FROM dg_create_draft WHERE discord_user_id = ?', [discordUserId]);
}

function buildLoginList(loginBase, qty) {
    if (qty === 1) return [loginBase];
    return Array.from({ length: qty }, (_, idx) => `${loginBase}${idx + 1}`);
}

function buildNicknameList(nicknameBase, qty) {
    if (qty === 1) return [nicknameBase];
    return Array.from({ length: qty }, (_, idx) => `${nicknameBase}${idx + 1}`);
}

async function createAccounts(pool, discordUserId, payload) {
    const {
        qty,
        loginBase,
        nicknameBase,
        password,
        email,
        secretQuestion,
        secretAnswer,
    } = payload;

    const logins = buildLoginList(loginBase, qty);
    const nicknames = buildNicknameList(nicknameBase, qty);
    const passwordHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex');

    const conn = await pool.getConnection();
    try {
        await conn.query('LOCK TABLES accounts WRITE, dg_discord_account WRITE, dg_link_attempt WRITE');

        const [[countRow]] = await conn.query(
            'SELECT COUNT(*) AS total FROM dg_discord_account WHERE discord_user_id = ?',
            [discordUserId]
        );

        const currentCount = Number(countRow?.total || 0);
        if (currentCount + qty > MAX_ACCOUNTS) {
            return { ok: false, error: 'Ya tienes 8 cuentas vinculadas. No puedes crear más.' };
        }

        const loginPlaceholders = logins.map(() => '?').join(', ');
        const nickPlaceholders = nicknames.map(() => '?').join(', ');
        const [existing] = await conn.query(
            `SELECT Login, Nickname FROM accounts
             WHERE Login IN (${loginPlaceholders}) OR Nickname IN (${nickPlaceholders})`,
            [...logins, ...nicknames]
        );

        if (existing.length) {
            const takenLogins = new Set(existing.map(row => row.Login));
            const takenNicks = new Set(existing.map(row => row.Nickname));
            const loginClashes = logins.filter(login => takenLogins.has(login));
            const nickClashes = nicknames.filter(nick => takenNicks.has(nick));
            const parts = [];
            if (loginClashes.length) parts.push(`Ya existe una cuenta con ese nombre: ${loginClashes.join(', ')}`);
            if (nickClashes.length) parts.push(`Ya existe un apodo con ese nombre: ${nickClashes.join(', ')}`);
            return { ok: false, error: `Hay datos ya en uso.\n${parts.join('\n')}` };
        }

        const created = [];
        for (let i = 0; i < qty; i += 1) {
            const login = logins[i];
            const nickname = nicknames[i];
            const [result] = await conn.query(
                `INSERT INTO accounts (Login, Password, Nickname, Email, SecretQuestion, SecretAnswer)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    login,
                    passwordHash,
                    nickname,
                    email || null,
                    secretQuestion,
                    secretAnswer,
                ]
            );

            const accountId = result.insertId;
            await conn.query(
                'INSERT INTO dg_discord_account (discord_user_id, account_id) VALUES (?, ?)',
                [discordUserId, accountId]
            );

            await conn.query(
                'INSERT INTO dg_link_attempt (discord_user_id, account_login, success) VALUES (?, ?, 1)',
                [discordUserId, login]
            );

            created.push({ login, nickname });
        }

        return { ok: true, created };
    } finally {
        try {
            await conn.query('UNLOCK TABLES');
        } catch (_) { }
        conn.release();
    }
}

async function refreshAccountsPanel(interaction, ctx) {
    const view = buildAccountsView();

    if (interaction.isButton()) {
        if (interaction.replied || interaction.deferred) {
            if (interaction.message?.editable) {
                return interaction.message.edit(view);
            }
            return interaction.editReply(view);
        }
        return interaction.update(view);
    }

    const channelId = ctx.accountsPanelChannelId || interaction.channelId;
    const panelId = ctx.accountsPanelId;

    if (!channelId || !panelId) return;

    const channel = await interaction.client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) return;

    const panelMsg = await channel.messages.fetch(panelId).catch(() => null);
    if (!panelMsg) return;

    await panelMsg.edit(view);
}

async function handlePasswordButton(interaction, ctx) {
    const pool = await ctx.db.getPool('auth');
    if (!pool) {
        return interaction.reply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            ephemeral: true,
        });
    }

    const accounts = await loadLinkedAccounts(pool, interaction.user.id);

    if (!accounts.length) {
        return interaction.reply({
            content: '🔴 No tienes cuentas vinculadas para cambiar la contraseña.',
            ephemeral: true,
        });
    }

    const options = accounts.map(account => ({
        label: account.Login,
        description: account.Nickname ? `Apodo: ${account.Nickname}` : undefined,
        value: String(account.Id),
    }));

    const selectRow = buildPassSelect(options);

    return interaction.reply({
        content: '🔑 **Cambiar contraseña**\nElige la cuenta que deseas actualizar:',
        components: [selectRow],
        ephemeral: true,
    });
}

async function handlePasswordSelect(interaction, ctx) {
    const pool = await ctx.db.getPool('auth');
    if (!pool) {
        return interaction.reply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            ephemeral: true,
        });
    }

    const accountId = Number.parseInt(interaction.values?.[0], 10);
    if (!Number.isFinite(accountId)) {
        return interaction.reply({
            content: '🔴 Selección inválida. Intenta nuevamente.',
            ephemeral: true,
        });
    }

    const account = await loadAccountForUser(pool, interaction.user.id, accountId);
    if (!account) {
        return interaction.reply({
            content: '🔴 No se encontró la cuenta seleccionada.',
            ephemeral: true,
        });
    }

    const modal = buildPasswordModal(account);
    return interaction.showModal(modal);
}

async function handlePasswordModal(interaction, ctx) {
    const pool = await ctx.db.getPool('auth');
    if (!pool) {
        return interaction.reply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            ephemeral: true,
        });
    }

    const accountId = Number.parseInt(interaction.customId.split(':').pop(), 10);
    if (!Number.isFinite(accountId)) {
        return interaction.reply({
            content: '🔴 No se pudo identificar la cuenta seleccionada.',
            ephemeral: true,
        });
    }

    const newPassword = normalizeInput(interaction.fields.getTextInputValue(INPUTS.PASS_NEW));
    const secretVerify = normalizeInput(interaction.fields.getTextInputValue(INPUTS.SECRET_VERIFY));

    if (!newPassword || !secretVerify) {
        return interaction.reply({
            content: '🔴 Completa la nueva contraseña y la respuesta secreta.',
            ephemeral: true,
        });
    }

    const account = await loadAccountForUser(pool, interaction.user.id, accountId);
    if (!account) {
        return interaction.reply({
            content: '🔴 No se encontró la cuenta seleccionada.',
            ephemeral: true,
        });
    }

    if (normalizeInput(account.SecretAnswer) !== secretVerify) {
        return interaction.reply({
            content: '🔴 La respuesta secreta no es correcta. No se cambió la contraseña.',
            ephemeral: true,
        });
    }

    const passwordHash = crypto.createHash('sha256').update(newPassword, 'utf8').digest('hex');

    await pool.query('UPDATE accounts SET Password = ? WHERE Id = ?', [passwordHash, accountId]);

    await interaction.reply({
        content: `✅ Contraseña actualizada para **${account.Login}**.`,
        ephemeral: true,
    });

    await refreshAccountsPanel(interaction, ctx);
    return undefined;
}

async function handleAccountsButton(interaction, ctx) {
    const responses = {
        'acc:unstuck': '🧰 **Desbuguear pj**\nConfirma el nombre del personaje. Te avisaré cuando esté listo.',
        'acc:help': '🆘 **Ayuda rápida**\nUsa los botones para crear cuentas, cambiar contraseña o desbuguear personajes.',
    };

    if (interaction.customId === 'acc:create') {
        const modal = buildCreateModalStep1();
        return interaction.showModal(modal);
    }

    if (interaction.customId === 'acc:pass') {
        return handlePasswordButton(interaction, ctx);
    }

    const replyContent = responses[interaction.customId] || 'Acción no reconocida.';

    if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
    }

    if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: replyContent });
    } else {
        await interaction.reply({ content: replyContent, ephemeral: true });
    }

    setTimeout(async () => {
        try {
            if (interaction.isRepliable()) {
                await interaction.deleteReply();
            }
        } catch (_) { }
    }, 10_000);

    await refreshAccountsPanel(interaction, ctx);
    return undefined;
}

async function handleCreateStep1(interaction, ctx) {
    const pool = await ctx.db.getPool('auth');;
    if (!pool) {
        return interaction.reply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            ephemeral: true,
        });
    }

    const qtyRaw = interaction.fields.getTextInputValue(INPUTS.QTY);
    const loginBase = normalizeInput(interaction.fields.getTextInputValue(INPUTS.LOGIN));
    const nicknameBase = normalizeInput(interaction.fields.getTextInputValue(INPUTS.NICK));
    const password = normalizeInput(interaction.fields.getTextInputValue(INPUTS.PASS));
    const email = normalizeInput(interaction.fields.getTextInputValue(INPUTS.EMAIL));

    const qty = parseQty(qtyRaw);
    if (!qty) {
        return interaction.reply({
            content: '🔴 El número de cuentas debe ser entre 1 y 8.',
            ephemeral: true,
        });
    }

    if (!loginBase || !nicknameBase || !password) {
        return interaction.reply({
            content: '🔴 Completa usuario, apodo y contraseña.',
            ephemeral: true,
        });
    }

    await saveDraft(pool, interaction.user.id, {
        qty,
        loginBase,
        nicknameBase,
        password,
        email,
    });

    const modal = buildCreateModalStep2();
    return interaction.showModal(modal);
}

async function handleCreateStep2(interaction, ctx) {
    const pool = await ctx.db.getPool('auth');;
    if (!pool) {
        return interaction.reply({
            content: '🟡 La base de datos no está configurada. Contacta con el Staff.',
            ephemeral: true,
        });
    }

    const secretQuestion = normalizeInput(interaction.fields.getTextInputValue(INPUTS.SECRET_Q));
    const secretAnswer = normalizeInput(interaction.fields.getTextInputValue(INPUTS.SECRET_A));

    if (!secretQuestion || !secretAnswer) {
        return interaction.reply({
            content: '🔴 Debes completar la pregunta y respuesta secreta.',
            ephemeral: true,
        });
    }

    const draft = await loadDraft(pool, interaction.user.id);
    await deleteDraft(pool, interaction.user.id);

    if (!draft) {
        return interaction.reply({
            content: '🟡 El formulario expiró. Intenta nuevamente.',
            ephemeral: true,
        });
    }

    const payload = {
        ...draft,
        secretQuestion,
        secretAnswer,
    };

    const result = await createAccounts(pool, interaction.user.id, payload);

    if (!result.ok) {
        return interaction.reply({
            content: `🔴 No se pudieron crear las cuentas.\n${result.error}`,
            ephemeral: true,
        });
    }

    const summary = result.created
        .map(item => `• **${item.login}** (${item.nickname})`)
        .join('\n');

    await interaction.reply({
        content: `✅ Cuentas creadas.:\n${summary}`,
        ephemeral: true,
    });

    await refreshAccountsPanel(interaction, ctx);
    return undefined;
}

async function handleAccountsModal(interaction, ctx) {
    if (interaction.customId === MODALS.CREATE_STEP1) {
        return handleCreateStep1(interaction, ctx);
    }

    if (interaction.customId === MODALS.CREATE_STEP2) {
        return handleCreateStep2(interaction, ctx);
    }

    if (interaction.customId.startsWith(`${MODALS.PASS_UPDATE}:`)) {
        return handlePasswordModal(interaction, ctx);
    }

    return refreshAccountsPanel(interaction, ctx);
}

module.exports = {
    handleAccountsButton,
    handleAccountsModal,
    handlePasswordSelect,
    refreshAccountsPanel,
};