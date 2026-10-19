import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Events, REST, Routes } from 'discord.js';
import { commands } from './commands.js';
import { handleCommand } from './handler.js';
import { handlePrefixCommand } from './prefix.js';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error('[AEGIS] No DISCORD_BOT_TOKEN found in .env. Add it and restart.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`[AEGIS] Online — logged in as ${readyClient.user.tag}`);

  try {
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationCommands(readyClient.user.id), { body: commands });
    console.log(`[AEGIS] Registered ${commands.length} slash commands globally.`);
  } catch (err) {
    console.error('[AEGIS] Failed to register slash commands:', err.message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  await handleCommand(interaction);
});

client.on(Events.MessageCreate, async (message) => {
  await handlePrefixCommand(message);
});

client.on(Events.GuildMemberAdd, (member) => {
  console.log(`[AEGIS] ${member.user.tag} joined ${member.guild.name}`);
});

client.on(Events.Error, (err) => {
  console.error('[AEGIS] Client error:', err.message);
});

client.login(token);
