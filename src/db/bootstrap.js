const fs = require('fs');
const path = require('path');

const BOOTSTRAP_PATH = path.resolve(__dirname, '../../.dg_bootstrap.json');

function hasRequiredFields(config) {
    if (!config || typeof config !== 'object') return false;
    const required = ['host', 'port', 'user', 'database'];
    return required.every((key) => String(config[key] ?? '').trim().length > 0);
}

function loadBootstrapConfig() {
    if (!fs.existsSync(BOOTSTRAP_PATH)) return null;

    try {
        const raw = fs.readFileSync(BOOTSTRAP_PATH, 'utf8');
        const data = JSON.parse(raw);
        return hasRequiredFields(data) ? data : null;
    } catch (_) {
        return null;
    }
}

function saveBootstrapConfig(config) {
    if (!hasRequiredFields(config)) return false;

    const payload = {
        host: String(config.host),
        port: String(config.port),
        user: String(config.user),
        password: String(config.password ?? ''),
        database: String(config.database),
    };

    fs.writeFileSync(BOOTSTRAP_PATH, JSON.stringify(payload, null, 2), 'utf8');
    return true;
}

function clearBootstrapConfig() {
    if (!fs.existsSync(BOOTSTRAP_PATH)) return;
    try {
        fs.unlinkSync(BOOTSTRAP_PATH);
    } catch (_) { }
}

module.exports = {
    loadBootstrapConfig,
    saveBootstrapConfig,
    clearBootstrapConfig,
};