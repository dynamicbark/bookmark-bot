import {
  APIApplicationCommandInteractionDataIntegerOption,
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  MessageFlags,
} from '@discordjs/core';
import { discordClient, prisma } from '../../index.js';
import {
  ApplicationCommand,
  ApplicationCommandContextType,
  ApplicationIntegrationTypes,
  getUserFromInteraction,
} from '../../utils/CommandUtils.js';

export const deleteChatInputCommandData: ApplicationCommand = {
  name: 'delete',
  description: 'Delete a bookmark.',
  type: ApplicationCommandType.ChatInput,
  integration_types: [ApplicationIntegrationTypes.UserInstall],
  contexts: [ApplicationCommandContextType.BotDM, ApplicationCommandContextType.Guild, ApplicationCommandContextType.PrivateChannel],
  options: [
    {
      type: ApplicationCommandOptionType.Integer,
      name: 'id',
      description: 'Bookmark id',
      required: true,
      min_value: 1,
    },
  ],
};

export async function deleteChatInputCommand(interaction: APIChatInputApplicationCommandInteraction) {
  // Get the options
  const bookmarkId = (
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'id')[0] as APIApplicationCommandInteractionDataIntegerOption
  ).value;
  // Defer the reply since it can take some time to process
  await discordClient.api.interactions.defer(interaction.id, interaction.token, {
    flags: MessageFlags.Ephemeral,
  });
  const user = getUserFromInteraction(interaction);
  // Check if it has been bookmarked by the user
  const foundBookmark = await prisma.bookmark.findFirst({
    where: {
      userId: BigInt(user.id),
      userBookmarkId: bookmarkId,
    },
  });
  if (!foundBookmark) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'The bookmark requested does not exist.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // Delete the bookmark
  await prisma.bookmark.delete({
    where: {
      id: foundBookmark.id,
    },
  });
  // Check if the message is linked to any other bookmarks
  const linkedMessagesCount = await prisma.bookmark.count({
    where: {
      messageId: foundBookmark.id,
    },
  });
  // If there are no bookmarks linked to the message
  if (linkedMessagesCount < 1) {
    await prisma.message.delete({
      where: {
        id: foundBookmark.messageId,
      },
    });
  }
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    content: 'The bookmark has been deleted.',
    flags: MessageFlags.Ephemeral,
  });
}
