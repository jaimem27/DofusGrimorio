const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const ABOUT_DESCRIPTION = [
    '**🤖 Dofus Grimorio - Bot de gestión para servidores privados de Dofus 2.X**',
    '',
    'Este bot conecta el servidor con Discord para mostrar información',
    'útil a jugadores y staff de forma automática.',
    '',
    '**💬 Contacto**',
    'Para dudas o sugerencias puedes contactar por Discord:',
    'Discord : Shine#0005',
    'Dutyfree Emulacion : https://discord.gg/8DAhv7tvxt',
    'Repositorio del proyecto : https://github.com/jaimem27/DofusGrimorio',
    '',
    '**❤️ Apoyo (opcional)**',
    'El bot es gratuito.',
    'Si te resulta útil y quieres apoyar su desarrollo:',
    'Paypal : paypal.me/InsideShine',
    '',
    '**⚠️ Aviso**',
    'Proyecto no oficial para servidores privados de Dofus 2.X.',
    'No afiliado a Ankama Games.',
    'Desarrollado originalmente por Shine "Inquisition" para dutyfree y su comunidad.',
    '',
    '**📦 Versión: v1.0.0**',
].join('\n');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('about')
        .setDescription('Muestra información general del bot.'),

    async execute(interaction) {
        const iconPath = path.resolve(__dirname, '../assets/bot/icon.png');
        const iconAttachment = new AttachmentBuilder(iconPath, { name: 'icon.png' });
        const embed = new EmbedBuilder()
            .setColor(0xffa500)
            .setDescription(ABOUT_DESCRIPTION)
            .setThumbnail('attachment://icon.png');

        return interaction.reply({ embeds: [embed], files: [iconAttachment] });
    },
};