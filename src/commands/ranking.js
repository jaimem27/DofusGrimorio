const { SlashCommandBuilder } = require('discord.js');
const { handleRankingCommand } = require('./ranking/handler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ranking')
        .setDescription('Muestra rankings del servidor.'),

    async execute(interaction, ctx) {
        return handleRankingCommand(interaction, ctx);
    },
};