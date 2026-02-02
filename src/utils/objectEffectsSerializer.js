'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Intenta cargar el mapa generado (effects-map.json)
 * - Se genera 1 vez desde EffectsEnum.cs
 * - En runtime solo usamos el JSON
 *
 * Ruta recomendada: <root>/data/effects-map.json
 */
function loadEffectsMap() {
    try {
        path.resolve(process.cwd(), 'src', 'data', 'effects-map.json')
        if (!fs.existsSync(p)) return null;
        const raw = fs.readFileSync(p, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

const EFFECTS_MAP = loadEffectsMap();

/**
 * Reader estilo .NET BinaryReader (LE) con string 7-bit.
 */
class DotNetBinaryReader {
    constructor(buffer) {
        this.buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        this.offset = 0;
    }

    ensure(length) {
        if (this.offset + length > this.buffer.length) {
            throw new RangeError(
                `Not enough data to read ${length} bytes at offset ${this.offset}.`
            );
        }
    }

    readByte() {
        this.ensure(1);
        const value = this.buffer.readUInt8(this.offset);
        this.offset += 1;
        return value;
    }

    readBoolean() {
        return this.readByte() !== 0;
    }

    readInt16() {
        this.ensure(2);
        const value = this.buffer.readInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    readUInt32() {
        this.ensure(4);
        const value = this.buffer.readUInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    readInt32() {
        this.ensure(4);
        const value = this.buffer.readInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    readDouble() {
        this.ensure(8);
        const value = this.buffer.readDoubleLE(this.offset);
        this.offset += 8;
        return value;
    }

    readBytes(length) {
        this.ensure(length);
        const value = this.buffer.subarray(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }

    read7BitEncodedInt() {
        let count = 0;
        let shift = 0;
        let byte;
        do {
            if (shift >= 35) {
                throw new RangeError('7-bit encoded int is too large.');
            }
            byte = this.readByte();
            count |= (byte & 0x7f) << shift;
            shift += 7;
        } while (byte & 0x80);
        return count;
    }

    readString() {
        const length = this.read7BitEncodedInt();
        if (length === 0) return '';
        const bytes = this.readBytes(length);
        return bytes.toString('utf8');
    }

    /**
     * Header byte como ASCII (más robusto que "readChar" UTF-8 variable).
     */
    readAsciiChar() {
        const b = this.readByte();
        return String.fromCharCode(b);
    }
}

const EFFECT_TYPES = {
    1: 'EffectBase',
    2: 'EffectCreature',
    3: 'EffectDate',
    4: 'EffectDice',
    5: 'EffectDuration',
    6: 'EffectInteger',
    7: 'EffectLadder',
    8: 'EffectMinMax',
    9: 'EffectMount',
    10: 'EffectString',
};

/**
 * Overrides bonitos (mandan por encima del JSON)
 */
const EFFECT_LABELS = {
    78: 'PM',
    105: 'Reducción de daños',
    106: 'Reenvío de hechizos',
    107: 'Reenvío de daños',
    110: 'Vitalidad',
    111: 'PA',
    112: 'Daños',
    114: 'Multiplicador de daños',
    115: 'Golpes críticos',
    116: 'Alcance',
    117: 'Alcance',
    118: 'Fuerza',
    119: 'Agilidad',
    123: 'Suerte',
    124: 'Sabiduría',
    125: 'Vitalidad',
    126: 'Inteligencia',
    136: 'Alcance',
    160: 'Esquiva PA',
    161: 'Esquiva PM',
    165: 'Daños (%)',
    174: 'Iniciativa',
    176: 'Prospección',
    178: 'Curaciones',
    182: 'Invocaciones',
    210: 'Resistencia Tierra (%)',
    211: 'Resistencia Agua (%)',
    212: 'Resistencia Aire (%)',
    213: 'Resistencia Fuego (%)',
    214: 'Resistencia Neutro (%)',
    220: 'Reenvío de daños',
    225: 'Daños de trampa',
    226: 'Daños de trampa (%)',
    240: 'Reducción Tierra',
    241: 'Reducción Agua',
    242: 'Reducción Aire',
    243: 'Reducción Fuego',
    244: 'Reducción Neutro',
    410: 'PM',
    412: 'PA',
};

function getEffectLabel(effectId, fallbackType) {
    // 1) Override bonito
    if (EFFECT_LABELS[effectId]) return EFFECT_LABELS[effectId];

    // 2) Fallback desde effects-map.json (summary / name)
    if (EFFECTS_MAP && EFFECTS_MAP[String(effectId)]) {
        const row = EFFECTS_MAP[String(effectId)];
        return row.summary || row.name || `Efecto ${effectId}`;
    }

    // 3) Último recurso
    return fallbackType || `Efecto ${effectId}`;
}

function isPercentLabel(label) {
    return label.includes('%') || label.includes('(%)');
}

function formatSigned(value) {
    if (typeof value !== 'number') return '';
    if (value > 0) return `+${value}`;
    if (value < 0) return `${value}`;
    return '0';
}

function formatRange(min, max) {
    if (typeof min !== 'number' || typeof max !== 'number') return '';
    if (min === max) return formatSigned(min);
    return `${formatSigned(min)} a ${formatSigned(max)}`;
}

function formatDateParts(year, month, day, hour, minute) {
    const pad = (v) => String(v).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

/**
 * Convierte el efecto a un "display" humano.
 * - Oculta el tipo interno EffectInteger/EffectDice
 * - Usa label bonito o fallback del JSON
 */
function decorateEffect(effect) {
    const label = getEffectLabel(effect.id, effect.type);
    const out = { ...effect, label, display: label };

    switch (effect.serializationId) {
        case 3: {
            out.display = `${label} ${formatDateParts(effect.year, effect.month, effect.day, effect.hour, effect.minute)}`;
            return out;
        }

        case 4: {
            // Dice suele venir como value + (diceNum, diceFace)
            // En items normalmente interesa el rango diceNum..diceFace
            const a = typeof effect.diceNum === 'number' ? effect.diceNum : null;
            const b = typeof effect.diceFace === 'number' ? effect.diceFace : null;

            if (a !== null && b !== null) {
                const min = Math.min(a, b);
                const max = Math.max(a, b);
                out.display = `${label} ${formatRange(min, max)}`;
                return out;
            }

            // fallback si algo raro
            if (typeof effect.value === 'number') {
                out.display = `${label} ${formatSigned(effect.value)}`;
            }
            return out;
        }

        case 5: {
            out.display = `${label} ${effect.days}d ${effect.hours}h ${effect.minutes}m`;
            return out;
        }

        case 6: {
            // Integer
            if (typeof effect.value === 'number') {
                out.display = `${label} ${formatSigned(effect.value)}`;
                // Si es un label de %, lo dejamos tal cual (ya incluye % en label)
                // No añadimos % extra para no duplicar.
            }
            return out;
        }

        case 8: {
            // MinMax
            // OJO: en readEffect lo guardamos como min/max correctamente
            out.display = `${label} ${formatRange(effect.min, effect.max)}`;
            return out;
        }

        case 10: {
            out.display = `${label} ${effect.text || ''}`.trim();
            return out;
        }

        default: {
            // Base / Unknown -> intenta mostrar value si existe
            if (typeof effect.value === 'number') {
                out.display = `${label} ${formatSigned(effect.value)}`;
            }
            return out;
        }
    }
}

/**
 * Lee la parte "base" del efecto (header 'C' o 'F')
 * Cambiado a ASCII byte para evitar problemas de UTF.
 */
function readBaseEffect(reader) {
    const header = reader.readAsciiChar();

    if (header === 'C') {
        return {
            header,
            id: reader.readInt16(),
            full: false,
        };
    }

    if (header !== 'F') {
        throw new Error(`Unexpected effect header '${header}'.`);
    }

    return {
        header,
        full: true,
        targetMask: reader.readString(),
        id: reader.readInt16(),
        uid: reader.readInt32(),
        duration: reader.readInt32(),
        delay: reader.readInt32(),
        random: reader.readInt32(),
        group: reader.readInt32(),
        modificator: reader.readInt32(),
        trigger: reader.readBoolean(),
        triggers: reader.readString(),
        hidden: reader.readBoolean(),
        rawZone: reader.readString(),
        order: reader.readInt32(),
        spellId: reader.readInt32(),
        effectElement: reader.readInt32(),
        dispellable: reader.readInt32(),
        forClientOnly: reader.readBoolean(),
    };
}

function readEffect(reader) {
    const serializationId = reader.readByte();
    const type = EFFECT_TYPES[serializationId] ?? 'UnknownEffect';

    const base = readBaseEffect(reader);
    const effect = {
        serializationId,
        type,
        ...base,
    };

    switch (serializationId) {
        case 1:
            return effect;

        case 2:
            effect.monsterFamily = reader.readInt16();
            return effect;

        case 3:
            effect.year = reader.readInt16();
            effect.month = reader.readInt16();
            effect.day = reader.readInt16();
            effect.hour = reader.readInt16();
            effect.minute = reader.readInt16();
            return effect;

        case 4:
            effect.value = reader.readInt32();
            effect.diceNum = reader.readInt32();
            effect.diceFace = reader.readInt32();
            return effect;

        case 5:
            effect.days = reader.readInt16();
            effect.hours = reader.readInt16();
            effect.minutes = reader.readInt16();
            return effect;

        case 6:
            effect.value = reader.readInt32();
            return effect;

        case 7:
            effect.monsterFamily = reader.readInt16();
            effect.monsterCount = reader.readInt16();
            return effect;

        case 8:
            // IMPORTANTE: min y max en orden lógico
            effect.min = reader.readInt16();
            effect.max = reader.readInt16();
            return effect;

        case 9: {
            effect.mount = {
                id: reader.readDouble(),
                expirationDate: reader.readDouble(),
                model: reader.readUInt32(),
                name: reader.readString(),
                owner: reader.readString(),
                level: reader.readUInt32(),
                sex: reader.readBoolean(),
                isRideable: reader.readBoolean(),
                isFecondationReady: reader.readBoolean(),
                reproductionCount: reader.readInt32(),
                reproductionCountMax: reader.readUInt32(),
            };
            {
                const effectsLength = reader.readInt32();
                const effectsBuffer = reader.readBytes(effectsLength);
                effect.mount.effectsBinaryBase64 = effectsBuffer.toString('base64');
            }
            {
                const capacitiesLength = reader.readInt32();
                effect.mount.capacities = [];
                for (let i = 0; i < capacitiesLength; i += 1) {
                    effect.mount.capacities.push(reader.readUInt32());
                }
            }
            return effect;
        }

        case 10:
            effect.text = reader.readString();
            return effect;

        default:
            throw new Error(`Unsupported effect serialization identifier '${serializationId}'.`);
    }
}

function deserializeEffects(buffer) {
    const reader = new DotNetBinaryReader(buffer);
    const effects = [];

    // Seguridad: evita loops infinitos si algo se descuadra
    while (reader.offset < reader.buffer.length) {
        const before = reader.offset;
        const eff = readEffect(reader);
        effects.push(decorateEffect(eff));

        if (reader.offset === before) {
            throw new Error('Reader offset did not advance; possible corrupted effects blob.');
        }
    }

    return effects;
}

function deserializeEffectsFromHex(hexString) {
    const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
    return deserializeEffects(Buffer.from(cleanHex, 'hex'));
}

function deserializeEffectsFromBase64(base64String) {
    return deserializeEffects(Buffer.from(base64String, 'base64'));
}

/**
 * Extra útil: compacta displays en una sola línea (para tu “modo completo”)
 */
function formatEffectsLine(effects, max = 10) {
    const lines = effects
        .map((e) => e.display)
        .filter(Boolean);

    if (lines.length <= max) return lines.join(' · ');
    return `${lines.slice(0, max).join(' · ')} · +${lines.length - max} más`;
}

module.exports = {
    deserializeEffects,
    deserializeEffectsFromHex,
    deserializeEffectsFromBase64,
    formatEffectsLine,
    EFFECT_LABELS,
};
