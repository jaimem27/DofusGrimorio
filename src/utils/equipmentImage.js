const { readPng, writePng, resizeNearest, drawImage } = require('./png');

const BASE_CANVAS = { width: 545, height: 525 };

const SLOT_POSITIONS = {
    0: { x: 19, y: 13, w: 74, h: 74 }, // Amuleto
    6: { x: 452, y: 13, w: 74, h: 74 }, // Sombrero
    15: { x: 19, y: 97, w: 74, h: 74 }, // Escudo
    1: { x: 452, y: 97, w: 74, h: 74 }, // Arma
    2: { x: 19, y: 181, w: 74, h: 74 }, // Anillo (izq.)
    4: { x: 452, y: 181, w: 74, h: 74 }, // Anillo (der.)
    3: { x: 19, y: 265, w: 74, h: 74 }, // Cinturón
    7: { x: 452, y: 265, w: 74, h: 74 }, // Capa
    5: { x: 19, y: 349, w: 74, h: 74 }, // Botas
    8: { x: 452, y: 349, w: 74, h: 74 }, // Mascota
    16: { x: 452, y: 349, w: 74, h: 74 }, // Montura
    18: { x: 452, y: 349, w: 74, h: 74 }, // Mascota viva
    9: { x: 19, y: 433, w: 74, h: 74 }, // Dofus 1
    10: { x: 105, y: 433, w: 74, h: 74 }, // Dofus 2
    11: { x: 192, y: 433, w: 74, h: 74 }, // Dofus 3
    12: { x: 278, y: 433, w: 74, h: 74 }, // Dofus 4
    13: { x: 365, y: 433, w: 74, h: 74 }, // Dofus 5
    14: { x: 452, y: 433, w: 74, h: 74 }, // Dofus 6
};

function getScaledSlotPositions(base) {
    const scaleX = base.width / BASE_CANVAS.width;
    const scaleY = base.height / BASE_CANVAS.height;

    return Object.fromEntries(
        Object.entries(SLOT_POSITIONS).map(([slotId, pos]) => [
            slotId,
            {
                x: Math.round(pos.x * scaleX),
                y: Math.round(pos.y * scaleY),
                w: Math.round(pos.w * scaleX),
                h: Math.round(pos.h * scaleY),
            },
        ])
    );
}

async function buildEquipmentImage({ basePath, equipmentBySlot, resolveIconPath }) {
    const base = readPng(basePath);
    if (!base) return null;

    const scaledPositions = getScaledSlotPositions(base);

    for (const [slotIdStr, pos] of Object.entries(scaledPositions)) {
        const slotId = Number(slotIdStr);
        const it = equipmentBySlot?.[slotId];
        if (!it) continue;

        const iconPath = resolveIconPath(it);
        if (!iconPath) continue;

        const icon = readPng(iconPath);
        if (!icon) continue;
        const resized = resizeNearest(icon, pos.w, pos.h);
        drawImage(base, resized, pos.x, pos.y);
    }

    return writePng(base);
}

module.exports = {
    buildEquipmentImage,
    SLOT_POSITIONS,
};