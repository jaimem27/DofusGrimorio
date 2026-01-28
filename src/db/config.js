async function getConfig(pool, key) {
    const [rows] = await pool.query(
        'SELECT `Value` FROM dg_config WHERE `Key` = ? LIMIT 1',
        [key]
    );

    return rows.length ? rows[0].Value : null;
}

async function getConfigMany(pool, keys) {
    if (!keys.length) return {};

    const placeholders = keys.map(() => '?').join(', ');
    const [rows] = await pool.query(
        `SELECT \`Key\`, \`Value\` FROM dg_config WHERE \`Key\` IN (${placeholders})`,
        keys
    );

    const map = {};
    for (const r of rows) map[r.Key] = r.Value;
    return map;
}

async function setConfig(pool, key, value) {
    await pool.query(
        `INSERT INTO dg_config (\`Key\`, \`Value\`)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE \`Value\` = VALUES(\`Value\`)`,
        [key, value]
    );
}

async function setConfigMany(pool, kv) {
    const entries = Object.entries(kv);
    if (!entries.length) return;

    const placeholders = entries.map(() => '(?, ?)').join(', ');
    const params = [];
    for (const [k, v] of entries) {
        params.push(k, String(v));
    }

    await pool.query(
        `INSERT INTO dg_config (\`Key\`, \`Value\`)
         VALUES ${placeholders}
         ON DUPLICATE KEY UPDATE \`Value\` = VALUES(\`Value\`)`,
        params
    );

}

async function delConfig(pool, key) {
    await pool.query(
        'DELETE FROM dg_config WHERE `Key` = ?',
        [key]
    );
}

async function delPrefix(pool, prefix) {
    await pool.query(
        'DELETE FROM dg_config WHERE `Key` LIKE ?',
        [`${prefix}%`]
    );
}

module.exports = { getConfig, getConfigMany, setConfig, setConfigMany, delConfig, delPrefix };