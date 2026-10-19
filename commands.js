import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

export const commands = [
  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if AEGIS is online and responding.'),

  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .addUserOption(o => o.setName('user').setDescription('The member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the kick').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .addUserOption(o => o.setName('user').setDescription('The member to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the ban').setRequired(false))
    .addIntegerOption(o => o.setName('days').setDescription('Days of messages to delete (0-7)').setRequired(false).setMinValue(0).setMaxValue(7))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Timeout a member for a duration.')
    .addUserOption(o => o.setName('user').setDescription('The member to timeout').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('How many minutes to mute').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the timeout').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('unmute')
    .setDescription('Remove a timeout from a member.')
    .addUserOption(o => o.setName('user').setDescription('The member to unmute').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn a member. Warnings are stored in the database.')
    .addUserOption(o => o.setName('user').setDescription('The member to warn').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason for the warning').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('View stored warnings for a member.')
    .addUserOption(o => o.setName('user').setDescription('The member to look up').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Delete a number of recent messages in this channel.')
    .addIntegerOption(o => o.setName('count').setDescription('Number of messages to delete (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show information about a member.')
    .addUserOption(o => o.setName('user').setDescription('The member to inspect').setRequired(false)),

  new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show information about this server.'),

  new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('Lock the current channel so only moderators can send messages.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock the current channel, restoring send permissions.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

  new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all AEGIS commands and what they do.'),
].map(cmd => cmd.toJSON());
