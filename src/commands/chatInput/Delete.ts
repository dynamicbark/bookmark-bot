import {
  APIApplicationCommandInteractionDataStringOption,
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
import { resolveBookmarkForUser } from '../../utils/DatabaseUtils.js';

export const deleteChatInputCommandData: ApplicationCommand = {
  name: 'delete',
  description: 'Delete a bookmark.',
  type: ApplicationCommandType.ChatInput,
  integration_types: [ApplicationIntegrationTypes.UserInstall],
  contexts: [ApplicationCommandContextType.BotDM, ApplicationCommandContextType.Guild, ApplicationCommandContextType.PrivateChannel],
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'id',
      description: 'Bookmark id or alias',
      required: true,
      min_length: 1,
    },
  ],
};

export async function deleteChatInputCommand(interaction: APIChatInputApplicationCommandInteraction) {
  // Get the options
  const bookmarkId = (
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'id')[0] as APIApplicationCommandInteractionDataStringOption
  ).value;
  // Defer the reply since it can take some time to process
  await discordClient.api.interactions.defer(interaction.id, interaction.token, {
    flags: MessageFlags.Ephemeral,
  });
  const user = getUserFromInteraction(interaction);
  // Resolve the bookmark
  const resolvedBookmark = await resolveBookmarkForUser(user.id, bookmarkId);
  if (!resolvedBookmark) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'The bookmark requested does not exist.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  // Delete the bookmark
  await prisma.bookmark.delete({
    where: {
      id: resolvedBookmark.id,
    },
  });
  // Check if the message is linked to any other bookmarks
  const linkedMessagesCount = await prisma.bookmark.count({
    where: {
      messageId: resolvedBookmark.id,
    },
  });
  // If there are no bookmarks linked to the message
  if (linkedMessagesCount < 1) {
    await prisma.message.delete({
      where: {
        id: resolvedBookmark.messageId,
      },
    });
  }
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    content: 'The bookmark has been deleted.',
    flags: MessageFlags.Ephemeral,
  });
}
