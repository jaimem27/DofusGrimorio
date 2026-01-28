const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(process.cwd(), 'logs');

function ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function todayFile(prefix = 'log') {
    const d = new Date();
    const yyyy = String(d.getFullYear());
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');

    return path.join(LOG_DIR, `${prefix}-${dd}-${mm}-${yyyy}.txt`);
}

function appendLine(filePath, line) {
    ensureLogDir();
    fs.appendFileSync(filePath, line + '\n', { encoding: 'utf8' });
}

function nowStamp() {
    return new Date().toISOString();
}

function logInfo(msg) {
    console.log(`${msg}`);
    appendLine(todayFile('info'), `[${nowStamp()}] ${msg}`);
}

function logWarn(msg) {
    console.warn(`${msg}`);
    appendLine(todayFile('warn'), `[${nowStamp()}] ${msg}`);
}

function logError(err, contextMsg = 'Error') {
    const file = todayFile('error');
    const header = `[${nowStamp()}] ${contextMsg}`;
    console.error(`${contextMsg}`);
    appendLine(file, header);

    if (err && typeof err === 'object') {
        const msg = err.message ? `${err.name || 'Error'}: ${err.message}` : `${err.name || 'Error'}`;
        console.error(msg);
        if (err.stack) console.error(err.stack);
        appendLine(file, `name: ${err.name || 'N/A'}`);
        appendLine(file, `message: ${err.message || 'N/A'}`);
        if (err.code) appendLine(file, `code: ${err.code}`);
        if (err.errno) appendLine(file, `errno: ${err.errno}`);
        if (err.sqlState) appendLine(file, `sqlState: ${err.sqlState}`);
        if (err.sqlMessage) appendLine(file, `sqlMessage: ${err.sqlMessage}`);
        if (err.stack) appendLine(file, `stack:\n${err.stack}`);
    } else {
        console.error(String(err));
        appendLine(file, String(err));
    }

    appendLine(file, '---');
}

module.exports = { logInfo, logWarn, logError, todayFile };
