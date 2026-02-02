const fs = require('fs');
const path = require('path');

const EQUIPMENT_ROOT = path.resolve(__dirname, '..', 'assets', 'equipamiento');
const EQUIPMENT_BASE_IMAGE = path.resolve(EQUIPMENT_ROOT, 'inventory.png');

const SLOT_FOLDER_HINTS = new Map([
    [0, 'Amuleto'],
    [2, 'Anillo'],
    [3, 'Cinturón'],
    [6, 'Sombrero'],
    [7, 'Capa'],
    [8, 'Mascota'],
    [9, 'Dofus'],
    [10, 'Dofus'],
    [11, 'Dofus'],
    [12, 'Dofus'],
    [13, 'Dofus'],
    [14, 'Dofus'],
    [15, 'Escudo'],
    [16, 'Mascotura'],
]);

let iconIndex = null;

function normalizeFolderName(value) {
    if (!value) return '';
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
}

function buildIconIndex() {
    const byFile = new Map();
    const byFolder = new Map();

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
                 if (!byFile.has(entry.name)) {
                    byFile.set(entry.name, entryPath);
                }
                const relative = path.relative(EQUIPMENT_ROOT, entryPath);
                const [folder] = relative.split(path.sep);
                if (folder && folder !== entry.name) {
                    const folderKey = normalizeFolderName(folder);
                    if (!byFolder.has(folderKey)) {
                        byFolder.set(folderKey, new Map());
                    }
                    byFolder.get(folderKey).set(entry.name, entryPath);
                }
            }
        }
    }

    return { byFile, byFolder };
}

function resolveEquipmentIconPath(itemId, hint = {}) {
    if (!Number.isFinite(Number(itemId))) return null;
    if (!iconIndex) {
        iconIndex = buildIconIndex();
    }
    const filename = `${itemId}.png`;
    const slotId = Number.isFinite(Number(hint?.slotId)) ? Number(hint.slotId) : null;
    const typeName = typeof hint?.typeName === 'string' ? hint.typeName : null;

    const folderHint = typeName || (slotId !== null ? SLOT_FOLDER_HINTS.get(slotId) : null);
    if (folderHint) {
        const folderKey = normalizeFolderName(folderHint);
        const folderMap = iconIndex.byFolder.get(folderKey);
        const scopedPath = folderMap?.get(filename);
        if (scopedPath) return scopedPath;
    }

    return iconIndex.byFile.get(filename) ?? null;
}

function resolveEquipmentBasePath() {
    return fs.existsSync(EQUIPMENT_BASE_IMAGE) ? EQUIPMENT_BASE_IMAGE : null;
}

module.exports = {
    resolveEquipmentIconPath,
    resolveEquipmentBasePath,
};