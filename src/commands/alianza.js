const { SlashCommandBuilder } = require('discord.js');
const { handleAllianceCommand } = require('./alianza/handler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alianza')
        .setDescription('Muestra información de una alianza.')
        .addStringOption((opt) =>
            opt
                .setName('nombre')
                .setDescription('Nombre o etiqueta de la alianza')
                .setRequired(true)
        ),

    async execute(interaction, ctx) {
        return handleAllianceCommand(interaction, ctx);
    },
};