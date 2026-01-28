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
        .setDescription('Configura Dofus Grimorio.)'),

    async execute(interaction, ctx) {
        if (!isAdmin(interaction)) {
            return interaction.reply({
                content: 'No tienes permisos de administrador para usar este comando.',
                ephemeral: true,
            });
        }

        if (!ctx.db) {
            const state = {
                authConfigured: false,
                worldConfigured: false,
                installed: false,
                tablesReady: false,
            };
            const view = buildInstallView(state);
            return interaction.reply({ ...view, ephemeral: true });
        }

        const state = await loadInstallState(ctx.db);
        const view = buildInstallView(state);
        return interaction.reply({ ...view, ephemeral: true });
    },
};
