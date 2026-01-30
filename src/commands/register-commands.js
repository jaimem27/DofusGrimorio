const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { REST, Routes } = require('discord.js');

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error('Faltan DISCORD_TOKEN / DISCORD_CLIENT_ID / DISCORD_GUILD_ID en .env');
  }


  const instalar = require('./instalar.js');
  const cuentas = require('./cuentas.js');

  const commands = [
    instalar.data.toJSON(),
    cuentas.data.toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log('Comandos registrados (GUILD) al instante.');
}

main().catch(console.error);
