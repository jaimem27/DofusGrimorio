const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');

function fmtInt(n) {
    return new Intl.NumberFormat('es-ES').format(Number(n));
}

function fmtDate(d) {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return new Intl.DateTimeFormat('es-ES', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date);
}

function sexName(sex) {
    if (sex === 0) return 'Masculino';
    if (sex === 1) return 'Femenino';
    return `Sex ${sex}`;
}

function resolveBreedThumbnail(breed) {
    const filename = `${breed}.png`;
    const filePath = path.resolve(__dirname, '..', '..', 'assets', 'clases', filename);
    if (!fs.existsSync(filePath)) return null;
    const name = `breed-${breed}.png`;
    return new AttachmentBuilder(filePath, { name });
}

function buildProfileView({
    character,
    level,
    hpNow,
    hpMax,
    xpPercent,
    xpRemaining,
    subareaName,
    tokens,
    breedName,
    equipmentSummary,
}) {
    const tokensLine = tokens !== null ? fmtInt(tokens) : '—';
    const xpPercentLine =
        xpPercent !== null ? `${xpPercent.toFixed(1)}%` : '—';
    const xpRemainingLine =
        xpRemaining !== null ? `${fmtInt(xpRemaining)} restantes` : '—';
    const xpLine =
        xpPercent !== null || xpRemaining !== null
            ? `**XP:** ${xpPercentLine} (${xpRemainingLine})`
            : '**XP:** —';

    const thumbnail = resolveBreedThumbnail(Number(character.Breed));
    const embed = new EmbedBuilder()
        .setTitle(`👤 ${character.Name} (Nv. ${level})`)
        .setColor(0x2f3136)
        .addFields(
            {
                name: '🪪 Clase',
                value:
                    `**Clase:** ${breedName ?? `Breed ${character.Breed}`}\n` +
                    `**Sexo:** ${sexName(Number(character.Sex))}`,
                inline: true,
            },
            {
                name: '❤️ Estado',
                value:
                    `**Vida:** ${fmtInt(hpNow)} / ${fmtInt(hpMax)}\n` +
                    `**PA:** ${character.AP} · **PM:** ${character.MP}\n` +
                    `**Energía:** ${character.Energy} / ${character.EnergyMax}`,
                inline: true,
            },
            {
                name: '💰 Economía / Progreso',
                value:
                    `**Kamas:** ${fmtInt(character.Kamas)}\n` +
                    `**Ogrinas:** ${tokensLine}\n` +
                    `${xpLine}`,
                inline: true,
            },
            {
                name: '🗺️ Ubicación',
                value:
                    `**Mapa:** ${character.MapId}\n` +
                    `**Zona:** ${subareaName ?? '—'}`,
                inline: true,
            },
            {
                name: '🕒 Actividad',
                value:
                    `**Último uso:** ${fmtDate(character.LastUsage)}\n` +
                    `**Creación:** ${fmtDate(character.CreationDate)}`,
                inline: true,
            }
        );

    if (equipmentSummary) {
        embed.addFields({
            name: '🎒 Equipamiento',
            value: equipmentSummary,
            inline: false,
        });
    }

    if (thumbnail) {
        embed.setThumbnail(`attachment://${thumbnail.name}`);
    }

    return {
        embeds: [embed],
        files: thumbnail ? [thumbnail] : [],
    };
}

module.exports = { buildProfileView };