const { readPng, writePng, resizeNearest, drawImage } = require('./png');

const BASE_CANVAS = { width: 539, height: 520 };

const SLOT_POSITIONS = {
    0: { x: 35, y: 35, w: 62, h: 62 }, // Amuleto
    2: { x: 35, y: 105, w: 62, h: 62 }, // Anillo (izq.)
    4: { x: 35, y: 174, w: 62, h: 62 }, // Anillo (der.)
    6: { x: 453, y: 35, w: 62, h: 62 }, // Sombrero
    7: { x: 453, y: 105, w: 62, h: 62 }, // Capa
    3: { x: 453, y: 174, w: 62, h: 62 }, // Cinturón
    5: { x: 453, y: 244, w: 62, h: 62 }, // Botas
    1: { x: 35, y: 333, w: 62, h: 62 }, // Arma
    15: { x: 105, y: 333, w: 62, h: 62 }, // Escudo
    17: { x: 253, y: 355, w: 43, h: 45 }, // Compañero
    16: { x: 383, y: 333, w: 62, h: 62 }, // Montura
    8: { x: 453, y: 333, w: 62, h: 62 }, // Mascota
    18: { x: 453, y: 333, w: 62, h: 62 }, // Mascota viva
    9: { x: 35, y: 422, w: 62, h: 62 }, // Dofus 1
    10: { x: 105, y: 422, w: 62, h: 62 }, // Dofus 2
    11: { x: 174, y: 422, w: 62, h: 62 }, // Dofus 3
    12: { x: 244, y: 422, w: 62, h: 62 }, // Dofus 4
    13: { x: 313, y: 422, w: 62, h: 62 }, // Dofus 5
    14: { x: 383, y: 422, w: 62, h: 62 }, // Dofus 6
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