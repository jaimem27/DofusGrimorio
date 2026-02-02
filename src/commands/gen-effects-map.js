import fs from "node:fs";
import path from "node:path";

// AJUSTA ESTAS RUTAS SI QUIERES
const INPUT_CS = path.resolve("EffectsEnum.cs");
const OUTPUT_JSON = path.resolve("data/effects-map.json");

function cleanSummary(summary) {
  return summary
    .replace(/^\s*\/\/\/\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

const content = fs.readFileSync(INPUT_CS, "utf8");

/**
 * Captura:
 * /// <summary>
 * /// texto
 * /// </summary>
 * EffectName = 123,
 */
const regex =
  /\/\/\/\s*<summary>\s*([\s\S]*?)\s*\/\/\/\s*<\/summary>\s*([\w]+)\s*=\s*(\d+)/g;

const map = {};
let match;

while ((match = regex.exec(content))) {
  const summary = cleanSummary(match[1]);
  const enumName = match[2];
  const id = Number(match[3]);

  map[id] = {
    name: enumName,
    summary,
  };
}

fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
fs.writeFileSync(OUTPUT_JSON, JSON.stringify(map, null, 2), "utf8");

console.log(`✅ effects-map.json generado (${Object.keys(map).length} efectos)`);
