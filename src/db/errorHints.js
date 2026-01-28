function dbHintFromError(err) {
    const code = err?.code;

    if (code === 'ECONNREFUSED') {
        return [
            'No se pudo conectar al servidor de BD (ECONNREFUSED).',
            'Revisa:',
            '- Host/IP y puerto (¿3306?)',
            '- La BD está encendida (MySQL/MariaDB running)',
            '- Firewall / Docker / binding (127.0.0.1 vs IP real)',
        ].join('\n');
    }

    if (code === 'ER_ACCESS_DENIED_ERROR') {
        return [
            'Acceso denegado (usuario/contraseña incorrectos) (ER_ACCESS_DENIED_ERROR).',
            'Revisa:',
            '- DB_*_USER y DB_*_PASS en el .env',
            '- Permisos del usuario para esa base de datos',
        ].join('\n');
    }

    if (code === 'ER_BAD_DB_ERROR') {
        return [
            'La base de datos no existe (ER_BAD_DB_ERROR).',
            'Revisa:',
            '- DB_*_NAME en el .env (nombre exacto)',
            '- Que la base de datos haya sido creada',
        ].join('\n');
    }

    if (code === 'PROTOCOL_CONNECTION_LOST') {
        return [
            'La conexión se perdió (PROTOCOL_CONNECTION_LOST).',
            'Revisa:',
            '- Estabilidad del servidor MySQL/MariaDB',
            '- Timeouts o reinicios del servicio',
        ].join('\n');
    }

    return [
        'Error de base de datos.',
        'Revisa host/puerto/usuario/password/nombre de BD y permisos.',
    ].join('\n');
}

module.exports =  { dbHintFromError };