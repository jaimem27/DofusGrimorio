const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

function intToRGB(color) {
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;
    return `rgb(${r}, ${g}, ${b})`;
}

function resolveEmblemPath(folder, shapeId) {
    const filename = `${shapeId}.png`;
    const filePath = path.resolve(__dirname, '..', 'assets', 'emblems', folder, filename);
    return fs.existsSync(filePath) ? filePath : null;
}

async function generarEmblema(bgColor, fgColor, fondoPath, iconoPath) {
    const size = 56;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    const fondo = await loadImage(fondoPath);
    const icono = await loadImage(iconoPath);

    const fondoCanvas = createCanvas(size, size);
    const fondoCtx = fondoCanvas.getContext('2d');

    fondoCtx.drawImage(fondo, 0, 0, size, size);
    fondoCtx.globalCompositeOperation = 'source-in';
    fondoCtx.fillStyle = intToRGB(bgColor);
    fondoCtx.fillRect(0, 0, size, size);

    const iconoCanvas = createCanvas(size, size);
    const iconoCtx = iconoCanvas.getContext('2d');

    iconoCtx.drawImage(icono, 0, 0, size, size);
    iconoCtx.globalCompositeOperation = 'source-in';
    iconoCtx.fillStyle = intToRGB(fgColor);
    iconoCtx.fillRect(0, 0, size, size);

    ctx.drawImage(fondoCanvas, 0, 0);
    ctx.drawImage(iconoCanvas, 0, 0);

    return canvas.toBuffer('image/png');
}

async function buildEmblemBuffer({
    backgroundFolder,
    backgroundShape,
    backgroundColor,
    foregroundShape,
    foregroundColor,
}) {
    const fondoPath = resolveEmblemPath(backgroundFolder, backgroundShape);
    const iconoPath = resolveEmblemPath('up', foregroundShape);

    if (!fondoPath || !iconoPath) return null;

    return generarEmblema(backgroundColor, foregroundColor, fondoPath, iconoPath);
}

module.exports = {
    buildEmblemBuffer,
    resolveEmblemPath,
};