const fs = require('fs');
const path = require('path');

const EQUIPMENT_ROOT = path.resolve(__dirname, '..', 'assets', 'equipamiento');
const EQUIPMENT_BASE_IMAGE = path.resolve(EQUIPMENT_ROOT, 'inventory.png');

let iconIndex = null;

function buildIconIndex() {
    const index = new Map();

    const stack = [EQUIPMENT_ROOT];
    while (stack.length) {
        const current = stack.pop();
        if (!current) continue;

        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
            const entryPath = path.join(current, entry.name);
            if (entry.isDirectory()) {
                stack.push(entryPath);
            } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
                index.set(entry.name, entryPath);
            }
        }
    }

    return index;
}

function resolveEquipmentIconPath(itemId) {
    if (!Number.isFinite(Number(itemId))) return null;
    if (!iconIndex) {
        iconIndex = buildIconIndex();
    }
    return iconIndex.get(`${itemId}.png`) ?? null;
}

function resolveEquipmentBasePath() {
    return fs.existsSync(EQUIPMENT_BASE_IMAGE) ? EQUIPMENT_BASE_IMAGE : null;
}

module.exports = {
    resolveEquipmentIconPath,
    resolveEquipmentBasePath,
};