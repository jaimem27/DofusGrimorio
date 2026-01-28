const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildInstallView } = require('./instalar/ui.js');
const { loadInstallState } = require('./instalar/handler.js');

function isAdmin(interaction) {
    const perms = interaction.memberPermissions;
    if (!perms) return false;
    return perms.has(PermissionFlagsBits.Administrator) || perms.has(PermissionFlagsBits.ManageGuild);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('instalar')
        .setDescription('Configura Dofus Grimorio. (Requiere permisos de administrador)'),

    async execute(interaction, ctx) {
        if (!isAdmin(interaction)) {
            await interaction.reply({
                content: 'No tienes permisos de administrador para usar este comando.',
                flags: MessageFlags.Ephemeral,
            });
        }
        const state = await loadInstallState(ctx.db);
        const view = buildInstallView(state);

        return interaction.reply({
            ...view,
            flags: MessageFlags.Ephemeral,
        });
    },
};
