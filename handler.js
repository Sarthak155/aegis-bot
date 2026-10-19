import {
  EmbedBuilder,
  PermissionFlagsBits,
  ChannelType,
} from 'discord.js';
import { logModeration, getWarningCount } from './db.js';

export async function handleCommand(interaction) {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, guild, member, options } = interaction;

  // Acknowledge immediately so Discord never shows "The application did not respond".
  // Every command below then uses editReply() instead of reply().
  await interaction.deferReply().catch(() => {});

  const ack = async () => {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }
  };

  const replyEmbed = (title, desc, color = 0x00ff99) => {
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setDescription(desc)
      .setColor(color)
      .setFooter({ text: 'AEGIS Security Bot' })
      .setTimestamp();
    return embed;
  };

  try {
    switch (commandName) {
      case 'ping': {
        await interaction.editReply({ content: 'Pinging...' });
        const latency = Date.now() - interaction.createdTimestamp;
        await interaction.editReply({
          content: `Pong! Round-trip: **${latency}ms** | Websocket: **${interaction.client.ws.ping}ms**`,
        });
        return;
      }

      case 'help': {
        const embed = replyEmbed(
          'AEGIS Command List',
          'Here are the security commands available with AEGIS:'
        ).addFields(
          { name: '/ping', value: 'Check if the bot is online.', inline: false },
          { name: '/kick <user>', value: 'Remove a member from the server.', inline: false },
          { name: '/ban <user>', value: 'Permanently ban a member.', inline: false },
          { name: '/mute <user> <minutes>', value: 'Timeout a member for a set time.', inline: false },
          { name: '/unmute <user>', value: 'Remove a timeout from a member.', inline: false },
          { name: '/warn <user>', value: 'Issue a stored warning to a member.', inline: false },
          { name: '/warnings <user>', value: 'View stored warnings for a member.', inline: false },
          { name: '/purge <count>', value: 'Delete recent messages (max 100).', inline: false },
          { name: '/userinfo [user]', value: 'Display info about a member.', inline: false },
          { name: '/serverinfo', value: 'Display info about this server.', inline: false },
          { name: '/lockdown', value: 'Lock the current channel to moderators only.', inline: false },
          { name: '/unlock', value: 'Unlock the current channel.', inline: false },
        );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      case 'userinfo': {
        const target = options.getUser('user') ?? interaction.user;
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        const embed = replyEmbed(`User Info — ${target.tag}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'User ID', value: target.id, inline: false },
            { name: 'Account Created', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:F>`, inline: false },
            { name: 'Joined Server', value: targetMember ? `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>` : 'Not in server', inline: false },
            { name: 'Roles', value: targetMember ? targetMember.roles.cache.map(r => r.name).join(', ') || 'None' : 'N/A', inline: false },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      case 'serverinfo': {
        const owner = await guild.fetchOwner().catch(() => null);
        const embed = replyEmbed(`Server Info — ${guild.name}`)
          .setThumbnail(guild.iconURL())
          .addFields(
            { name: 'Server ID', value: guild.id, inline: false },
            { name: 'Owner', value: owner ? owner.user.tag : 'Unknown', inline: false },
            { name: 'Members', value: `${guild.memberCount}`, inline: true },
            { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
            { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false },
          );
        await interaction.editReply({ embeds: [embed] });
        return;
      }

      case 'kick': {
        await ack();
        const target = options.getUser('user');
        const reason = options.getString('reason') ?? 'No reason provided';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: 'That user is not in this server.' });
          return;
        }
        if (!targetMember.kickable) {
          await interaction.editReply({ content: 'I cannot kick that member — they may have a higher role than me.' });
          return;
        }
        await targetMember.kick(reason);
        await logModeration({
          guild_id: guild.id,
          target_id: target.id,
          target_tag: target.tag,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'kick',
          reason,
        });
        await interaction.editReply({ embeds: [replyEmbed('Member Kicked', `**${target.tag}** has been kicked.\n**Reason:** ${reason}`)] });
        return;
      }

      case 'ban': {
        await ack();
        const target = options.getUser('user');
        const reason = options.getString('reason') ?? 'No reason provided';
        const days = options.getInteger('days') ?? 0;
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (targetMember && !targetMember.bannable) {
          await interaction.editReply({ content: 'I cannot ban that member — they may have a higher role than me.' });
          return;
        }
        await guild.bans.create(target.id, { deleteMessageSeconds: days * 86400, reason });
        await logModeration({
          guild_id: guild.id,
          target_id: target.id,
          target_tag: target.tag,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'ban',
          reason,
        });
        await interaction.editReply({ embeds: [replyEmbed('Member Banned', `**${target.tag}** has been banned.\n**Reason:** ${reason}\n**Messages deleted:** ${days} day(s)`)] });
        return;
      }

      case 'mute': {
        await ack();
        const target = options.getUser('user');
        const minutes = options.getInteger('minutes');
        const reason = options.getString('reason') ?? 'No reason provided';
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: 'That user is not in this server.' });
          return;
        }
        if (!targetMember.moderatable) {
          await interaction.editReply({ content: 'I cannot timeout that member — they may have a higher role than me.' });
          return;
        }
        const until = Date.now() + minutes * 60 * 1000;
        await targetMember.timeout(minutes * 60 * 1000, reason);
        await logModeration({
          guild_id: guild.id,
          target_id: target.id,
          target_tag: target.tag,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'mute',
          reason,
          duration: `${minutes} minute(s)`,
        });
        await interaction.editReply({ embeds: [replyEmbed('Member Muted', `**${target.tag}** has been muted for **${minutes} minute(s)**.\n**Reason:** ${reason}\n**Ends:** <t:${Math.floor(until / 1000)}:F>`)] });
        return;
      }

      case 'unmute': {
        await ack();
        const target = options.getUser('user');
        const targetMember = await guild.members.fetch(target.id).catch(() => null);
        if (!targetMember) {
          await interaction.editReply({ content: 'That user is not in this server.' });
          return;
        }
        if (!targetMember.isCommunicationDisabled()) {
          await interaction.editReply({ content: 'That member is not currently muted.' });
          return;
        }
        await targetMember.timeout(null, 'Mute removed by moderator');
        await logModeration({
          guild_id: guild.id,
          target_id: target.id,
          target_tag: target.tag,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'unmute',
          reason: 'Manual unmute',
        });
        await interaction.editReply({ embeds: [replyEmbed('Member Unmuted', `**${target.tag}** has been unmuted.`, 0x00ff99)] });
        return;
      }

      case 'warn': {
        await ack();
        const target = options.getUser('user');
        const reason = options.getString('reason') ?? 'No reason provided';
        const total = await getWarningCount(guild.id, target.id);
        await logModeration({
          guild_id: guild.id,
          target_id: target.id,
          target_tag: target.tag,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'warn',
          reason,
        });
        await interaction.editReply({
          embeds: [replyEmbed(
            'Member Warned',
            `**${target.tag}** has been warned.\n**Reason:** ${reason}\n**Total warnings:** ${total + 1}`,
            total + 1 >= 3 ? 0xff9900 : 0xffcc00
          )],
        });
        return;
      }

      case 'warnings': {
        await ack();
        const target = options.getUser('user');
        const count = await getWarningCount(guild.id, target.id);
        if (count === 0) {
          await interaction.editReply({ content: `**${target.tag}** has no stored warnings.` });
          return;
        }
        await interaction.editReply({
          embeds: [replyEmbed('Warning Lookup', `**${target.tag}** has **${count}** stored warning(s) in this server.`, 0xffcc00)],
        });
        return;
      }

      case 'purge': {
        await ack();
        const count = options.getInteger('count');
        const messages = await interaction.channel.messages.fetch({ limit: count });
        const deleted = await interaction.channel.bulkDelete(messages, true);
        await logModeration({
          guild_id: guild.id,
          target_id: 'channel',
          target_tag: `#${interaction.channel.name}`,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'purge',
          reason: `Deleted ${deleted.size} messages in #${interaction.channel.name}`,
        });
        await interaction.editReply({ embeds: [replyEmbed('Messages Purged', `Deleted **${deleted.size}** message(s) from <#${interaction.channel.id}>.`)] });
        setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
        return;
      }

      case 'lockdown': {
        await ack();
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: false,
          AddReactions: false,
        });
        await logModeration({
          guild_id: guild.id,
          target_id: 'channel',
          target_tag: `#${interaction.channel.name}`,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'lockdown',
          reason: `Locked #${interaction.channel.name}`,
        });
        await interaction.editReply({ embeds: [replyEmbed('Channel Locked', `🔒 <#${interaction.channel.id}> is now locked. Only moderators can send messages.`, 0xff3333)] });
        return;
      }

      case 'unlock': {
        await ack();
        await interaction.channel.permissionOverwrites.edit(guild.roles.everyone, {
          SendMessages: null,
          AddReactions: null,
        });
        await logModeration({
          guild_id: guild.id,
          target_id: 'channel',
          target_tag: `#${interaction.channel.name}`,
          moderator_id: interaction.user.id,
          moderator_tag: interaction.user.tag,
          action: 'unlock',
          reason: `Unlocked #${interaction.channel.name}`,
        });
        await interaction.editReply({ embeds: [replyEmbed('Channel Unlocked', `🔓 <#${interaction.channel.id}> has been unlocked. Members can send messages again.`, 0x00ff99)] });
        return;
      }

      default: {
        await interaction.editReply({ content: 'Unknown command.' }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(`[AEGIS] Command error (${commandName}):`, err);
    const msg = `An error occurred while running \`/${commandName}\`. ${err.message ?? ''}`;
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: msg }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
}
