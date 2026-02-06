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
  const perfil = require('./perfil.js');
  const social = require('./social.js');
  const ranking = require('./ranking.js');
  const gremio = require('./gremio.js');
  const alianza = require('./alianza.js');
  const about = require('./about.js');

  const commands = [
    instalar.data.toJSON(),
    cuentas.data.toJSON(),
    perfil.data.toJSON(),
    social.data.toJSON(),
    ranking.data.toJSON(),
    gremio.data.toJSON(),
    alianza.data.toJSON(),
    about.data.toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(token);

  await rest.put(
    Routes.applicationGuildCommands(clientId, guildId),
    { body: commands }
  );

  console.log('Comandos registrados (GUILD) al instante.');
}

main().catch(console.error);
