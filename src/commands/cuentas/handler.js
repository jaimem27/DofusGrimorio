const { buildAccountsView } = require('./ui.js');

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

async function handleAccountsButton(interaction, ctx) {
    const responses = {
        'acc:create': '✅ **Crear cuenta(s)**\nIndica cuántas cuentas necesitas (1–8) y el rellena el formulario.',
        'acc:pass': '🔑 **Cambiar contraseña**\nCambia tu contraseña, necesitas la respuesta secreta.',
        'acc:unstuck': '🧰 **Desbuguear pj**\nConfirma el nombre del personaje. Te avisaré cuando esté listo.',
        'acc:help': '🆘 **Ayuda rápida**\nUsa los botones para crear cuentas, cambiar contraseña o desbuguear personajes.',
    };

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

module.exports = {
    handleAccountsButton,
    refreshAccountsPanel,
};