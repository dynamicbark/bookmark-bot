import { APIAttachment, APIEmbed, APIMessageReference, MessageType } from '@discordjs/core';
import { Bookmark, Message, Tag, User } from '@prisma/client';

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

export function createEmbedFromBookmark(bookmark: Bookmark, message: Message, author: User, tags?: Tag[]): APIEmbed {
  const messageData = JSON.parse(message.data!.toString());
  let footerText = `#${bookmark.userBookmarkId}`;
  if (tags) {
    const notAutogeneratedTags = tags.filter((tag) => !tag.autogenerated).map((tag) => tag.name);
    if (notAutogeneratedTags.length !== 0) {
      footerText += ` - ${notAutogeneratedTags.join(' ').substring(0, 1024)}`;
    }
  }
  return {
    author: {
      name: `${author.username}${author.displayName ? ` (${author.displayName})` : ``}`,
      url: `https://discord.com/channels/${messageData.guild_id || '@me'}/${messageData.channel_id}/${messageData.id}`,
      icon_url: getUserAvatarUrl(`${author.id}`, author.avatarHash),
    },
    description: messageData.content,
    timestamp: messageData.timestamp,
    footer: {
      text: footerText,
    },
  };
}

export function getUserAvatarUrl(userId: string, avatarHash: string | null): string {
  if (avatarHash === null) {
    const index = Number(BigInt(userId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.png`;
}
