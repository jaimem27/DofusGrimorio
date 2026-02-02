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

function alignmentSideName(side) {
    if (side === 1) return 'Bonta';
    if (side === 2) return 'Brakmar';
    if (side === 3) return 'Mercenario';
    return 'Neutral';
}

function formatSurvival(wins, losses) {
    const winValue = Number(wins ?? 0);
    const lossValue = Number(losses ?? 0);
    const total = winValue + lossValue;
    if (total <= 0) return '—';
    return `${Math.round((winValue / total) * 100)}%`;
}

function formatBaseWithPermanent(baseValue, permanentValue) {
    const base = fmtInt(baseValue ?? 0);
    const permanent = Number(permanentValue ?? 0);
    const permanentLabel = `${permanent >= 0 ? '+' : ''}${fmtInt(permanent)}`;
    return `${base} (${permanentLabel})`;
}

function buildStatsBlock(character, alignmentLevel) {
    const challenges = fmtInt(character.ChallengesCount ?? 0);
    const challengesDungeon = fmtInt(character.ChallengesInDungeonCount ?? 0);
    const achievementPoints = fmtInt(character.AchievementPoints ?? 0);

    const winPvm = fmtInt(character.WinPvm ?? 0);
    const losPvm = fmtInt(character.LosPvm ?? 0);
    const winPvp = fmtInt(character.WinPvp ?? 0);
    const losPvp = fmtInt(character.LosPvp ?? 0);
    const pvmSurvival = formatSurvival(character.WinPvm, character.LosPvm);
    const pvpSurvival = formatSurvival(character.WinPvp, character.LosPvp);

    const alignmentSide = alignmentSideName(Number(character.AlignmentSide ?? 0));
    const honor = fmtInt(character.Honor ?? 0);
    const alignmentLevelLine =
        Number.isFinite(Number(alignmentLevel)) && Number(alignmentLevel) > 0
            ? `Nv. ${alignmentLevel}`
            : 'Nv. —';

    const strength = formatBaseWithPermanent(
        character.Strength,
        character.PermanentAddedStrength
    );
    const intelligence = formatBaseWithPermanent(
        character.Intelligence,
        character.PermanentAddedIntelligence
    );
    const chance = formatBaseWithPermanent(
        character.Chance,
        character.PermanentAddedChance
    );
    const agility = formatBaseWithPermanent(
        character.Agility,
        character.PermanentAddedAgility
    );
    const vitality = formatBaseWithPermanent(
        character.Vitality,
        character.PermanentAddedVitality
    );
    const wisdom = fmtInt(character.Wisdom ?? 0);
    const prospection = fmtInt(character.Prospection ?? 0);
    const ap = fmtInt(character.AP ?? 0);
    const mp = fmtInt(character.MP ?? 0);

    return [
        `❤️ **Vitalidad:** ${vitality}`,
        `🪄 **Sabiduría:** ${wisdom}`,
        `💪 **Fuerza:** ${strength}`,
        `🧠 **Inteligencia:** ${intelligence}`,
        `🏃 **Agilidad:** ${agility}`,
        `🍀 **Suerte:** ${chance}`,
        '',
        `🔷 **PA:** ${ap} · 🟩 **PM:** ${mp}`,
        `🔎**Prospección (PP):** ${prospection}`,
        '',
        `🏅 **Desafíos:** ${challenges}`,
        `🏰 **Desafíos en mazmorras:** ${challengesDungeon}`,
        `⭐ **Puntos de logro:** ${achievementPoints}`,
        '',
        `⚔️ **PvM:** ${winPvm}V / ${losPvm}D · ${pvmSurvival} victoria`,
        `🥊 **PvP:** ${winPvp}V / ${losPvp}D · ${pvpSurvival} victoria`,
        `🛡️ **Alineamiento:** ${alignmentSide} (${alignmentLevelLine})`,
        `🎖️ **Honor:** ${honor}`,
    ].join('\n');
}

function buildProfileButtons(characterId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`perfil.tab:summary:${characterId}`)
            .setLabel('Resumen')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`perfil.tab:stats:${characterId}`)
            .setLabel('Stats')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`perfil.tab:equipment:${characterId}`)
            .setLabel('Equipamiento')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`perfil.tab:jobs:${characterId}`)
            .setLabel('Oficios')
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
    guildName,
    equipmentSummary,
    equipmentDetails,
    statsBlock,
    jobsLines,
    equipmentImage,
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

    if (tab === 'stats') {
        embed
            .setTitle(`${character.Name} (Nv. ${level})`)
            .setDescription(statsBlock ?? 'Sin estadísticas.');
    } else if (tab === 'jobs') {
        embed
            .setTitle(`🛠️${character.Name}`)
            .setDescription(jobsLines ?? 'Sin oficios registrados.');
    } else if (tab === 'equipment') {
        embed
            .setTitle(`${character.Name} (Nv. ${level})`)
            .addFields({
                name: '🎒 Equipamiento',
                value: equipmentDetails || 'Sin equipamiento.',
                inline: false,
            });
        if (equipmentImage) {
            embed.setImage(`attachment://${equipmentImage.name}`);
        }
    } else {
        embed
            .setTitle(`👤 ${character.Name} (Nv. ${level})`)
            .addFields(
                {
                    name: '🪪 Clase',
                    value:
                        `**Clase:** ${breedName ?? `Breed ${character.Breed}`}\n` +
                        `**Sexo:** ${sexName(Number(character.Sex))}\n` +
                        `**Gremio:** ${guildName ?? '—'}`,
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

    }

    if (thumbnail) {
        embed.setThumbnail(`attachment://${thumbnail.name}`);
    }

    const files = [];
    if (thumbnail) {
        files.push(thumbnail);
    }
    if (equipmentImage) {
        files.push(equipmentImage);
    }

    return {
        embeds: [embed],
        files,
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

function buildEquipmentView({ character, level, equipmentLines, equipmentImage, components = [] }) {
    const embed = new EmbedBuilder()
        .setTitle(`${character.Name} (Nv. ${level})`)
        .setColor(0x2f3136)
        .setDescription(equipmentLines);

    if (equipmentImage) {
        embed.setImage(`attachment://${equipmentImage.name}`);
    }

    return {
        embeds: [embed],
        files: equipmentImage ? [equipmentImage] : [],
        components: components.length ? components : [buildProfileButtons(character.Id)],
    };
}

function buildItemStatsView({ character, item, slotName, effectsLines, iconAttachment, components = [] }) {
    const description = [
        `**${slotName}**`,
        `**Nivel:** ${Number.isFinite(Number(item.ItemLevel)) ? item.ItemLevel : '—'}`,
        '',
        (effectsLines?.length ? effectsLines : ['Sin efectos']).join('\n'),
    ].join('\n');

    const embed = new EmbedBuilder()
        .setTitle(`📊 ${item.ItemName ?? `Obj ${item.ItemId}`}`)
        .setColor(0x2f3136)
        .setDescription(description);

    if (iconAttachment) {
        embed.setThumbnail(`attachment://${iconAttachment.name}`);
    }

    return {
        embeds: [embed],
        files: iconAttachment ? [iconAttachment] : [],
        components,
    };
}

module.exports = {
    buildProfileView,
    buildStatsView,
    buildEquipmentView,
    buildStatsBlock,
    buildItemStatsView,
};