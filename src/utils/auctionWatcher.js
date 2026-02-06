const { EmbedBuilder } = require('discord.js');
const { logWarn, logError } = require('../logger/logger.js');

const DEFAULT_REFRESH_MS = Number(process.env.AUCTION_REFRESH_MS || 30000);
const MAX_TRACKED_ITEMS = Number(process.env.AUCTION_TRACKED_LIMIT || 500);
const trackedItems = new Map();

function formatTimestamp(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('es-ES');
}

function buildAuctionEmbed(item, name) {
    const sold = Number(item.Sold) === 1;
    const statusLine = sold ? 'Se ha comprado' : 'Se ha puesto en venta';
    const descriptionLines = [
        `**${statusLine}:**`,
        `${name} x${item.Stack}`,
        `**Precio:** ${item.Price}`,
    ];
    const when = formatTimestamp(item.SellDate);
    if (when) descriptionLines.push(`\n*${when}`);

    return new EmbedBuilder()
        .setColor(sold ? 0xff0000 : 0x3498db)
        .setDescription(descriptionLines.join('\n'));
}

async function ensureBidhouseSupport(db, worldPool) {
    try {
        const [rows] = await worldPool.query("SHOW TABLES LIKE 'bidhouse_items'");
        const supported = Array.isArray(rows) && rows.length > 0;
        if (!supported) {
            await db.config.setMany({
                'auction.enabled': '0',
                'auction.supported': '0',
            });
        } else {
            await db.config.set('auction.supported', '1');
        }
        return supported;
    } catch (err) {
        logWarn(`No se pudo verificar soporte de subastas: ${err.message || err}`);
        return false;
    }
}

async function fetchItemNames(worldPool, itemIds) {
    if (!itemIds.length) return new Map();
    const [rows] = await worldPool.query(
        `SELECT Id, Name FROM items_templates WHERE Id IN (?)
         UNION ALL
         SELECT Id, Name FROM items_templates_weapons WHERE Id IN (?)`,
        [itemIds, itemIds]
    );

    const map = new Map();
    for (const row of rows || []) {
        if (!map.has(row.Id)) {
            map.set(row.Id, row.Name);
        }
    }
    return map;
}

function trimTrackedItems() {
    while (trackedItems.size > MAX_TRACKED_ITEMS) {
        const firstKey = trackedItems.keys().next().value;
        if (firstKey === undefined) return;
        trackedItems.delete(firstKey);
    }
}

function trackAuctionItem(item) {
    trackedItems.set(item.Id, {
        sold: Number(item.Sold) === 1,
        itemId: item.ItemId,
        stack: item.Stack,
        price: item.Price,
    });
    trimTrackedItems();
}

function chunkArray(values, chunkSize) {
    const chunks = [];
    for (let i = 0; i < values.length; i += chunkSize) {
        chunks.push(values.slice(i, i + chunkSize));
    }
    return chunks;
}

async function fetchItemsByIds(worldPool, ids) {
    if (!ids.length) return [];
    const chunks = chunkArray(ids, 200);
    const results = [];
    for (const chunk of chunks) {
        const [rows] = await worldPool.query(
            `SELECT Id, OwnerId, Price, Sold, SellDate, ItemId, Stack
             FROM bidhouse_items
             WHERE Id IN (?)`,
            [chunk]
        );
        if (rows && rows.length) results.push(...rows);
    }
    return results;
}

async function pollAuctionChannel(client, db) {
    const cfg = await db.config.getMany([
        'install.done',
        'auction.channel_id',
        'auction.last_id',
        'auction.enabled',
    ]);

    if ((cfg['install.done'] ?? '0') !== '1') return;
    if ((cfg['auction.enabled'] ?? '0') !== '1') return;
    const channelId = (cfg['auction.channel_id'] ?? '').toString().trim();
    if (!channelId) return;

    const worldPool = await db.getPool('world');
    if (!worldPool) return;

    const supported = await ensureBidhouseSupport(db, worldPool);
    if (!supported) return;

    const lastId = Number(cfg['auction.last_id'] ?? 0);
    const [newRows] = await worldPool.query(
        `SELECT Id, OwnerId, Price, Sold, SellDate, ItemId, Stack
         FROM bidhouse_items
         WHERE Id > ?
         ORDER BY Id ASC
         LIMIT 50`,
        [Number.isFinite(lastId) ? lastId : 0]
    );

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
        await db.config.set('auction.enabled', '0');
        logWarn('Canal de subastas inválido. Se desactivó el envío automático.');
        return;
    }

    let maxId = lastId;
    const newItems = Array.isArray(newRows) ? newRows : [];
    for (const item of newItems) {
        if (item.Id > maxId) maxId = item.Id;
    }

    const trackedIds = Array.from(trackedItems.keys());
    const trackedRows = await fetchItemsByIds(worldPool, trackedIds);
    const soldUpdates = [];
    for (const item of trackedRows) {
        const cached = trackedItems.get(item.Id);
        if (!cached) continue;
        const soldNow = Number(item.Sold) === 1;
        if (soldNow && !cached.sold) {
            soldUpdates.push(item);
            trackedItems.delete(item.Id);
            continue;
        }
        if (!soldNow) {
            trackAuctionItem(item);
        } else {
            trackedItems.delete(item.Id);
        }
    }

    for (const item of newItems) {
        if (Number(item.Sold) !== 1) {
            trackAuctionItem(item);
        }
    }

    const allItemsToNotify = [...newItems, ...soldUpdates];
    if (allItemsToNotify.length) {
        const itemIds = Array.from(
            new Set(allItemsToNotify.map(row => row.ItemId).filter(Boolean))
        );
        const nameMap = await fetchItemNames(worldPool, itemIds);

        for (const item of allItemsToNotify) {
            const name = nameMap.get(item.ItemId) || `Objeto ${item.ItemId}`;
            const embed = buildAuctionEmbed(item, name);
            try {
                await channel.send({ embeds: [embed] });
            } catch (err) {
                logWarn(`No se pudo enviar mensaje de subasta: ${err.message || err}`);
            }
        }
    }

    if (maxId !== lastId) {
        await db.config.set('auction.last_id', String(maxId));
    }
}

function startAuctionWatcher(client, db, intervalMs = DEFAULT_REFRESH_MS) {
    const ms = Number.isFinite(Number(intervalMs)) && Number(intervalMs) > 0
        ? Number(intervalMs)
        : DEFAULT_REFRESH_MS;

    const tick = () => {
        pollAuctionChannel(client, db).catch(err => {
            logError(err, 'Error en watcher de subastas');
        });
    };

    tick();
    return setInterval(tick, ms);
}

module.exports = { startAuctionWatcher };