'use strict';

class DotNetBinaryReader {
    constructor(buffer) {
        this.buffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        this.offset = 0;
    }

    ensure(length) {
        if (this.offset + length > this.buffer.length) {
            throw new RangeError(`Not enough data to read ${length} bytes at offset ${this.offset}.`);
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
        if (length === 0) {
            return '';
        }
        const bytes = this.readBytes(length);
        return bytes.toString('utf8');
    }

    readChar() {
        const firstByte = this.readByte();
        if (firstByte <= 0x7f) {
            return String.fromCharCode(firstByte);
        }
        let byteCount = 1;
        if ((firstByte & 0xe0) === 0xc0) {
            byteCount = 2;
        } else if ((firstByte & 0xf0) === 0xe0) {
            byteCount = 3;
        } else if ((firstByte & 0xf8) === 0xf0) {
            byteCount = 4;
        }
        const remaining = this.readBytes(byteCount - 1);
        return Buffer.concat([Buffer.from([firstByte]), remaining]).toString('utf8');
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

const EFFECT_LABELS = {
    78: 'PM',
    110: 'Vitalidad',
    111: 'PA',
    112: 'Daños',
    115: 'Golpes críticos',
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

function formatSigned(value) {
    if (value > 0) {
        return `+${value}`;
    }
    if (value < 0) {
        return `${value}`;
    }
    return '0';
}

function formatRange(min, max) {
    if (min === max) {
        return formatSigned(min);
    }
    return `${formatSigned(min)} a ${formatSigned(max)}`;
}

function formatDateParts(year, month, day, hour, minute) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`;
}

function decorateEffect(effect) {
    const label = EFFECT_LABELS[effect.id] ?? effect.type;
    const withLabel = { ...effect, label };

    switch (effect.serializationId) {
        case 3:
            withLabel.display = `${label} ${formatDateParts(effect.year, effect.month, effect.day, effect.hour, effect.minute)}`;
            break;
        case 4: {
            const min = Math.min(effect.diceNum, effect.diceFace);
            const max = Math.max(effect.diceNum, effect.diceFace);
            if (min === 0 && max === 0) {
                withLabel.display = `${label} ${formatSigned(effect.value)}`;
            } else {
                withLabel.display = `${label} ${formatRange(min, max)}`;
            }
            break;
        }
        case 5:
            withLabel.display = `${label} ${effect.days}d ${effect.hours}h ${effect.minutes}m`;
            break;
        case 6:
            withLabel.display = `${label} ${formatSigned(effect.value)}`;
            break;
        case 8:
            withLabel.display = `${label} ${formatRange(effect.min, effect.max)}`;
            break;
        case 10:
            withLabel.display = `${label} ${effect.text}`;
            break;
        default:
            if (typeof effect.value === 'number') {
                withLabel.display = `${label} ${formatSigned(effect.value)}`;
            } else {
                withLabel.display = label;
            }
    }

    return withLabel;
}

function readBaseEffect(reader) {
    const header = reader.readChar();
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
            effect.max = reader.readInt16();
            effect.min = reader.readInt16();
            return effect;
        case 9:
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
    while (reader.offset < reader.buffer.length) {
        effects.push(decorateEffect(readEffect(reader)));
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

module.exports = {
    deserializeEffects,
    deserializeEffectsFromHex,
    deserializeEffectsFromBase64,
};