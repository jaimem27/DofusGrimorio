const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildAccountsView } = require('./cuentas/ui.js');

function isAdmin(interaction) {
    const perms = interaction.memberPermissions;
    if (!perms) return false;
    return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cuentas')
        .setDescription('Centro de creación/gestión de cuentas y soporte rápido.'),

    async execute(interaction, ctx) {
        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: 'No tienes permisos de administrador para usar este comando.',
                ephemeral: true,
            });
        }

        const view = buildAccountsView();
        await interaction.deferReply();
        const msg = await interaction.editReply(view);
        if (ctx) {
            ctx.accountsPanelId = msg.id;
            ctx.accountsPanelChannelId = interaction.channelId;
        }
        return undefined;
    },
};