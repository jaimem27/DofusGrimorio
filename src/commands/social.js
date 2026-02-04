const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildSocialView } = require('./social/ui.js');

function isAdmin(interaction) {
    const perms = interaction.memberPermissions;
    if (!perms) return false;
    return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('social')
        .setDescription('Panel social con acciones de comunidad y votos.'),

    async execute(interaction, ctx) {
        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: 'No tienes permisos de administrador para usar este comando.',
                ephemeral: true,
            });
        }

        const view = buildSocialView();
        await interaction.deferReply();
        const msg = await interaction.editReply(view);
        if (ctx) {
            ctx.socialPanelId = msg.id;
            ctx.socialPanelChannelId = interaction.channelId;
        }
        return undefined;
    },
};