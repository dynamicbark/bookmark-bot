import {
  APIApplicationCommandInteractionDataBooleanOption,
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
import { createEmbedFromBookmark } from '../../utils/MessageUtils.js';

export const showChatInputCommandData: ApplicationCommand = {
  name: 'show',
  description: 'Show a bookmark.',
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
    {
      type: ApplicationCommandOptionType.Boolean,
      name: 'show_others',
      description: 'Let others see the bookmark.',
      required: false,
    },
  ],
};

export async function showChatInputCommand(interaction: APIChatInputApplicationCommandInteraction) {
  // Get the options
  const bookmarkId = (
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'id')[0] as APIApplicationCommandInteractionDataIntegerOption
  ).value;
  const showOthers =
    (
      interaction.data.options!.filter(
        (opt) => opt.name.toLowerCase() === 'show_others',
      )[0] as APIApplicationCommandInteractionDataBooleanOption
    )?.value || false;
  // Defer the reply since it can take some time to process
  await discordClient.api.interactions.defer(interaction.id, interaction.token, {
    flags: !showOthers ? MessageFlags.Ephemeral : undefined,
  });
  const user = getUserFromInteraction(interaction);
  // Find the bookmark to show
  const foundBookmark = await prisma.bookmark.findFirst({
    where: {
      userId: BigInt(user.id),
      userBookmarkId: bookmarkId,
    },
    include: {
      tags: true,
      message: true,
    },
  });
  if (!foundBookmark) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'The bookmark requested does not exist.',
      flags: !showOthers ? MessageFlags.Ephemeral : undefined,
    });
    return;
  }
  const bookmarkAuthor = await prisma.user.findFirst({
    where: {
      id: BigInt(foundBookmark.message.authorId),
    },
  });
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    embeds: [createEmbedFromBookmark(foundBookmark, foundBookmark.message, bookmarkAuthor!, foundBookmark.tags)],
    flags: !showOthers ? MessageFlags.Ephemeral : undefined,
  });
}
