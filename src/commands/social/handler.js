const { IDS } = require('./ui.js');

const VOTE_COOLDOWN_MS = 2 * 60 * 60 * 1000;

function getVoteReward() {
    const reward = Number.parseInt(process.env.VOTE_TOKEN_REWARD || '1', 10);
    return Number.isFinite(reward) && reward > 0 ? reward : 1;
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
        `UPDATE accounts SET Tokens = Tokens + ?, LastVote = NOW() WHERE Id = ?`,
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

async function handleSocialButton(interaction, ctx) {
    if (interaction.customId === IDS.BTN_VOTE) {
        return handleVote(interaction, ctx);
    }
    return undefined;
}

module.exports = { handleSocialButton };