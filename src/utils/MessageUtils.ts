import { APIAttachment, APIEmbed, APIMessageReference, MessageType, RESTPostAPIChannelMessageJSONBody } from '@discordjs/core';
import { User } from '@prisma/client';

export type StandardizedMessage = {
  id: string;
  guild_id?: string;
  channel_id: string;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  attachments: APIAttachment[];
  embeds: APIEmbed[];
  type: MessageType;
  message_reference?: APIMessageReference;
};

// storedAt is currently unused, but will be used if breaking changes are made by Discord for the message format
export function standardizeMessage(storedMessageString: string, _storedAt: number): StandardizedMessage {
  const storedMessage = JSON.parse(storedMessageString);
  return {
    id: storedMessage.id,
    guild_id: storedMessage.guild_id !== null ? storedMessage.guild_id : undefined,
    channel_id: storedMessage.channel_id,
    content: storedMessage.content,
    timestamp: storedMessage.timestamp,
    edited_timestamp: storedMessage.edited_timestamp !== null ? storedMessage.edited_timestamp : undefined,
    attachments: storedMessage.attachments,
    embeds: storedMessage.embeds,
    type: storedMessage.type,
    message_reference: storedMessage.message_reference !== null ? storedMessage.message_reference : undefined,
  };
}

export function createEmbedFromMessage(user: User, message: StandardizedMessage): RESTPostAPIChannelMessageJSONBody {
  return {
    content: `[Jump to message!](https://discord.com/channels/${message.guild_id || '@me'}/${message.channel_id}/${message.id})`,
    embeds: [
      {
        author: {
          name: `${user.username}${user.displayName ? ` (${user.displayName})` : ``}`,
          icon_url: getUserAvatarUrl(`${user.id}`, user.avatarHash),
        },
        description: message.content,
        timestamp: message.timestamp,
      },
    ],
  };
}

export function getUserAvatarUrl(userId: string, avatarHash: string | null): string {
  if (avatarHash === null) {
    const index = Number(BigInt(userId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}
