const { readPng, writePng, resizeNearest, drawImage } = require('./png');

const SLOT_POSITIONS = {
    0: { x: 35, y: 35, w: 62, h: 62 }, // Amuleto
    2: { x: 35, y: 105, w: 62, h: 62 }, // Anillo (izq.)
    3: { x: 35, y: 174, w: 62, h: 62 }, // Cinturón
    6: { x: 452, y: 35, w: 62, h: 62 }, // Sombrero
    7: { x: 453, y: 105, w: 62, h: 62 }, // Capa
    8: { x: 453, y: 174, w: 62, h: 62 }, // Mascota
    16: { x: 453, y: 243, w: 62, h: 62 }, // Montura
    1: { x: 35, y: 333, w: 62, h: 62 }, // Arma
    15: { x: 105, y: 333, w: 62, h: 62 }, // Escudo
    9: { x: 105, y: 422, w: 62, h: 62 }, // Dofus 1
    10: { x: 174, y: 422, w: 62, h: 62 }, // Dofus 2
    11: { x: 244, y: 422, w: 62, h: 62 }, // Dofus 3
    12: { x: 313, y: 422, w: 62, h: 62 }, // Dofus 4
    13: { x: 382, y: 422, w: 62, h: 62 }, // Dofus 5
    14: { x: 451, y: 422, w: 62, h: 62 }, // Dofus 6
};
async function buildEquipmentImage({ basePath, equipmentBySlot, resolveIconPath }) {
    const base = readPng(basePath);
    if (!base) return null;

    for (const [slotIdStr, pos] of Object.entries(SLOT_POSITIONS)) {
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