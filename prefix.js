import {
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { logModeration, getWarningCount } from './db.js';

const PREFIX = '?';

const embed = (title, desc, color = 0x00ff99) =>
  new EmbedBuilder()
    .setTitle(title)
    .setDescription(desc)
    .setColor(color)
    .setFooter({ text: 'AEGIS Security Bot' })
    .setTimestamp();

const parseDuration = (input) => {
  const match = /^(\d+)([mhd])$/i.exec(input ?? '');
  if (!match) return null;
  const n = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return { ms: n * 60 * 1000, label: `${n} minute(s)` };
  if (unit === 'h') return { ms: n * 60 * 60 * 1000, label: `${n} hour(s)` };
  if (unit === 'd') return { ms: n * 24 * 60 * 60 * 1000, label: `${n} day(s)` };
  return null;
};

const hasPerm = (member, flag) => member.permissions.has(flag);

const sendError = (message, text) =>
  message.reply({ embeds: [embed('Error', text, 0xff3333)] }).catch(() => {});

export async function handlePrefixCommand(message) {
  if (message.author.bot || !message.guild) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const command = args.shift()?.toLowerCase();
  if (!command) return;

  const { guild, member } = message;
  const mentions = message.mentions.users;

  switch (command) {
    case 'ping': {
      const sent = await message.reply({ content: 'Pinging...' });
      const latency = sent.createdTimestamp - message.createdTimestamp;
      await sent.edit({
        content: `Pong! Round-trip: **${latency}ms** | Websocket: **${message.client.ws.ping}ms**`,
      });
      return;
    }

    case 'help': {
      const e = embed('AEGIS Command List', 'Prefix commands (also available as slash commands `/`):').addFields(
        { name: '?ping', value: 'Check if the bot is online.', inline: false },
        { name: '?kick @user [reason]', value: 'Kick a member.', inline: false },
        { name: '?ban @user [reason]', value: 'Ban a member.', inline: false },
        { name: '?timeout @user 1m|1h|1d [reason]', value: 'Mute a member for a duration.', inline: false },
        { name: '?unmute @user', value: 'Remove a timeout.', inline: false },
        { name: '?warn @user [reason]', value: 'Warn a member (stored).', inline: false },
        { name: '?warnings @user', value: 'View stored warnings.', inline: false },
        { name: '?purge <count>', value: 'Delete recent messages (max 100).', inline: false },
        { name: '?userinfo [@user]', value: 'Show member info.', inline: false },
        { name: '?serverinfo', value: 'Show server info.', inline: false },
        { name: '?lockdown', value: 'Lock this channel.', inline: false },
        { name: '?unlock', value: 'Unlock this channel.', inline: false },
      );
      await message.reply({ embeds: [e] });
      return;
    }

    case 'userinfo': {
      const target = mentions.first() ?? message.author;
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      const e = embed(`User Info — ${target.tag}`)
        .setThumbnail(target.displayAvatarURL())
        .addFields(
          { name: 'User ID', value: target.id, inline: false },
          { name: 'Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:F>`, inline: false },
          { name: 'Joined Server', value: targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>` : 'Not in server', inline: false },
          { name: 'Roles', value: targetMember ? targetMember.roles.cache.map(r => r.name).join(', ') || 'None' : 'N/A', inline: false },
        );
      await message.reply({ embeds: [e] });
      return;
    }

    case 'serverinfo': {
      const owner = await guild.fetchOwner().catch(() => null);
      const e = embed(`Server Info — ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'Server ID', value: guild.id, inline: false },
          { name: 'Owner', value: owner ? owner.user.tag : 'Unknown', inline: false },
          { name: 'Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
        );
      await message.reply({ embeds: [e] });
      return;
    }

    case 'kick': {
      if (!hasPerm(member, PermissionFlagsBits.KickMembers))
        return sendError(message, 'You need the **Kick Members** permission.');
      const target = mentions.first();
      if (!target) return sendError(message, 'Mention a user: `?kick @user [reason]`');
      const reason = args.join(' ') || 'No reason provided';
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) return sendError(message, 'That user is not in this server.');
      if (!targetMember.kickable) return sendError(message, 'I cannot kick that member — they may outrank me.');
      await targetMember.kick(reason);
      await logModeration({
        guild_id: guild.id, target_id: target.id, target_tag: target.tag,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'kick', reason,
      });
      await message.reply({ embeds: [embed('Member Kicked', `**${target.tag}** has been kicked.\n**Reason:** ${reason}`)] });
      return;
    }

    case 'ban': {
      if (!hasPerm(member, PermissionFlagsBits.BanMembers))
        return sendError(message, 'You need the **Ban Members** permission.');
      const target = mentions.first();
      if (!target) return sendError(message, 'Mention a user: `?ban @user [reason]`');
      const reason = args.join(' ') || 'No reason provided';
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (targetMember && !targetMember.bannable) return sendError(message, 'I cannot ban that member — they may outrank me.');
      await guild.bans.create(target.id, { deleteMessageDays: 0, reason });
      await logModeration({
        guild_id: guild.id, target_id: target.id, target_tag: target.tag,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'ban', reason,
      });
      await message.reply({ embeds: [embed('Member Banned', `**${target.tag}** has been banned.\n**Reason:** ${reason}`)] });
      return;
    }

    case 'timeout':
    case 'mute': {
      if (!hasPerm(member, PermissionFlagsBits.ModerateMembers))
        return sendError(message, 'You need the **Timeout Members** permission.');
      const target = mentions.first();
      if (!target) return sendError(message, 'Usage: `?timeout @user 1m|1h|1d [reason]`');
      const durationInput = args[0];
      const duration = parseDuration(durationInput);
      if (!duration) return sendError(message, 'Provide a duration like `1m`, `1h`, or `1d`.\nExample: `?timeout @user 1h being disruptive`');
      args.shift();
      const reason = args.join(' ') || 'No reason provided';
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) return sendError(message, 'That user is not in this server.');
      if (!targetMember.moderatable) return sendError(message, 'I cannot timeout that member — they may outrank me.');
      const until = Date.now() + duration.ms;
      await targetMember.timeout(duration.ms, reason);
      await logModeration({
        guild_id: guild.id, target_id: target.id, target_tag: target.tag,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'mute', reason, duration: duration.label,
      });
      await message.reply({
        embeds: [embed('Member Muted', `**${target.tag}** has been muted for **${duration.label}**.\n**Reason:** ${reason}\n**Ends:** <t:${Math.floor(until / 1000)}:F>`)],
      });
      return;
    }

    case 'unmute': {
      if (!hasPerm(member, PermissionFlagsBits.ModerateMembers))
        return sendError(message, 'You need the **Timeout Members** permission.');
      const target = mentions.first();
      if (!target) return sendError(message, 'Mention a user: `?unmute @user`');
      const targetMember = await guild.members.fetch(target.id).catch(() => null);
      if (!targetMember) return sendError(message, 'That user is not in this server.');
      if (!targetMember.isCommunicationDisabled()) return sendError(message, 'That member is not currently muted.');
      await targetMember.timeout(null, 'Mute removed by moderator');
      await logModeration({
        guild_id: guild.id, target_id: target.id, target_tag: target.tag,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'unmute', reason: 'Manual unmute',
      });
      await message.reply({ embeds: [embed('Member Unmuted', `**${target.tag}** has been unmuted.`, 0x00ff99)] });
      return;
    }

    case 'warn': {
      if (!hasPerm(member, PermissionFlagsBits.ModerateMembers))
        return sendError(message, 'You need the **Moderate Members** permission.');
      const target = mentions.first();
      if (!target) return sendError(message, 'Mention a user: `?warn @user [reason]`');
      const reason = args.join(' ') || 'No reason provided';
      const total = await getWarningCount(guild.id, target.id);
      await logModeration({
        guild_id: guild.id, target_id: target.id, target_tag: target.tag,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'warn', reason,
      });
      await message.reply({
        embeds: [embed('Member Warned', `**${target.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${total + 1}`, total + 1 >= 3 ? 0xff9900 : 0xffcc00)],
      });
      return;
    }

    case 'warnings': {
      if (!hasPerm(member, PermissionFlagsBits.ModerateMembers))
        return sendError(message, 'You need the **Moderate Members** permission.');
      const target = mentions.first();
      if (!target) return sendError(message, 'Mention a user: `?warnings @user`');
      const count = await getWarningCount(guild.id, target.id);
      if (count === 0) {
        await message.reply({ content: `**${target.tag}** has no stored warnings.` });
        return;
      }
      await message.reply({ embeds: [embed('Warning Lookup', `**${target.tag}** has **${count}** stored warning(s) in this server.`, 0xffcc00)] });
      return;
    }

    case 'purge': {
      if (!hasPerm(member, PermissionFlagsBits.ManageMessages))
        return sendError(message, 'You need the **Manage Messages** permission.');
      const count = parseInt(args[0], 10);
      if (!count || count < 1 || count > 100)
        return sendError(message, 'Provide a number between 1 and 100: `?purge 50`');
      const messages = await message.channel.messages.fetch({ limit: count + 1 });
      const deleted = await message.channel.bulkDelete(messages, true);
      const e = embed('Messages Purged', `Deleted **${deleted.size - 1}** message(s) from <#${message.channel.id}>.`);
      const reply = await message.channel.send({ embeds: [e] });
      setTimeout(() => reply.delete().catch(() => {}), 5000);
      await logModeration({
        guild_id: guild.id, target_id: 'channel', target_tag: `#${message.channel.name}`,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'purge', reason: `Deleted ${deleted.size} messages in #${message.channel.name}`,
      });
      return;
    }

    case 'lockdown':
    case 'lock': {
      if (!hasPerm(member, PermissionFlagsBits.ManageChannels))
        return sendError(message, 'You need the **Manage Channels** permission.');
      await message.channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false, AddReactions: false,
      });
      await logModeration({
        guild_id: guild.id, target_id: 'channel', target_tag: `#${message.channel.name}`,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'lockdown', reason: `Locked #${message.channel.name}`,
      });
      await message.reply({ embeds: [embed('Channel Locked', `🔒 <#${message.channel.id}> is now locked. Only moderators can send messages.`, 0xff3333)] });
      return;
    }

    case 'unlock': {
      if (!hasPerm(member, PermissionFlagsBits.ManageChannels))
        return sendError(message, 'You need the **Manage Channels** permission.');
      await message.channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null, AddReactions: null,
      });
      await logModeration({
        guild_id: guild.id, target_id: 'channel', target_tag: `#${message.channel.name}`,
        moderator_id: message.author.id, moderator_tag: message.author.tag,
        action: 'unlock', reason: `Unlocked #${message.channel.name}`,
      });
      await message.reply({ embeds: [embed('Channel Unlocked', `🔓 <#${message.channel.id}> has been unlocked.`, 0x00ff99)] });
      return;
    }

    default:
      return;
  }
}
