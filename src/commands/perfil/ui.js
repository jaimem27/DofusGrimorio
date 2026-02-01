const fs = require('fs');
const path = require('path');
const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

function statLine(label, base, perm) {
    const baseValue = Number(base ?? 0);
    const permValue = Number(perm ?? 0);
    return `**${label}:** ${baseValue} (+${permValue})`;
}

function buildStatsBlock(character) {
    return [
        statLine('Fuerza', character.Strength, character.PermanentAddedStrength),
        statLine('Inteligencia', character.Intelligence, character.PermanentAddedIntelligence),
        statLine('Suerte', character.Chance, character.PermanentAddedChance),
        statLine('Agilidad', character.Agility, character.PermanentAddedAgility),
        statLine('Vitalidad', character.Vitality, character.PermanentAddedVitality),
        statLine('Sabiduría', character.Wisdom, character.PermanentAddedWisdom),
        '',
        `🎯 **Prospección (PP):** ${Number(character.Prospection ?? 0)}`,
        `🔷 **PA:** ${Number(character.AP ?? 0)}   🟩 **PM:** ${Number(character.MP ?? 0)}`,
    ].join('\n');
}

function buildProfileButtons(characterId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`perfil.btn:stats:${characterId}`)
            .setLabel('Stats')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`perfil.btn:equip:${characterId}`)
            .setLabel('Equipamiento')
            .setStyle(ButtonStyle.Secondary)
    );
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
    equipmentDetails,
    tab = 'summary',
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

    const embed = new EmbedBuilder().setColor(0x2f3136);

    if (equipmentSummary) {
        embed.addFields({
            name: '🎒 Equipamiento',
            value: equipmentSummary,
            inline: false,
        });
    }

    if (tab === 'stats') {
        embed
            .setTitle(`📊 Stats de ${character.Name} (Nv. ${level})`)
            .addFields(
                {
                    name: '🪪 Clase',
                    value:
                        `**Clase:** ${breedName ?? `Breed ${character.Breed}`}\n` +
                        `**Sexo:** ${sexName(Number(character.Sex))}`,
                    inline: true,
                },
                {
                    name: '❤️ Vitalidad',
                    value: `**Vida:** ${fmtInt(hpNow)} / ${fmtInt(hpMax)}`,
                    inline: true,
                },
                {
                    name: '⚔️ PA / PM',
                    value: `**PA:** ${character.AP} · **PM:** ${character.MP}`,
                    inline: true,
                },
                {
                    name: '⚡ Energía',
                    value: `**Energía:** ${character.Energy} / ${character.EnergyMax}`,
                    inline: true,
                },
                {
                    name: '💰 Economía',
                    value: `**Kamas:** ${fmtInt(character.Kamas)}\n**Ogrinas:** ${tokensLine}`,
                    inline: true,
                },
                {
                    name: '✨ Experiencia',
                    value: xpLine,
                    inline: true,
                }
            );
    } else if (tab === 'equipment') {
        embed
            .setTitle(`🎒 Equipamiento de ${character.Name} (Nv. ${level})`)
            .addFields({
                name: '🧰 Objetos equipados',
                value: equipmentDetails || 'Sin equipamiento.',
                inline: false,
            });
    } else {
        embed
            .setTitle(`👤 ${character.Name} (Nv. ${level})`)
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
    }

    if (thumbnail) {
        embed.setThumbnail(`attachment://${thumbnail.name}`);
    }

    return {
        embeds: [embed],
        files: thumbnail ? [thumbnail] : [],
        components: [buildProfileButtons(character.Id)],
    };
}

function buildStatsView({ character, level, statsBlock }) {
    const embed = new EmbedBuilder()
        .setTitle(`📊 Stats de ${character.Name} (Nv. ${level})`)
        .setColor(0x2f3136)
        .setDescription(statsBlock);

    return {
        embeds: [embed],
        components: [buildProfileButtons(character.Id)],
    };
}

function buildEquipmentView({ character, level, equipmentLines }) {
    const embed = new EmbedBuilder()
        .setTitle(`🎒 Equipamiento de ${character.Name} (Nv. ${level})`)
        .setColor(0x2f3136)
        .setDescription(equipmentLines);

    return {
        embeds: [embed],
        components: [buildProfileButtons(character.Id)],
    };
}

module.exports = {
    buildProfileView,
    buildStatsView,
    buildEquipmentView,
    buildStatsBlock,
};