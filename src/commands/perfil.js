const { SlashCommandBuilder } = require('discord.js');
const { handlePerfilCommand } = require('./perfil/handler.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Muestra el perfil de un personaje.')
        .addStringOption((opt) =>
            opt
                .setName('nombre')
                .setDescription('Nombre del personaje')
                .setRequired(false)
        ),

    async execute(interaction, ctx) {
        return handlePerfilCommand(interaction, ctx);
    },
};