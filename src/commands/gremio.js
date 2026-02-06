const { SlashCommandBuilder } = require('discord.js');
const { handleGuildCommand } = require('./gremio/handler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gremio')
        .setDescription('Muestra información de un gremio.')
        .addStringOption((opt) =>
            opt
                .setName('nombre')
                .setDescription('Nombre del gremio')
                .setRequired(true)
        ),

    async execute(interaction, ctx) {
        return handleGuildCommand(interaction, ctx);
    },
};