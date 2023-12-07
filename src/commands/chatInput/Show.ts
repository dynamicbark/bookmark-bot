import {
  APIApplicationCommandInteractionDataBooleanOption,
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonStyle,
  ComponentType,
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
import { createEmbedFromBookmark, getMessageLink } from '../../utils/MessageUtils.js';

export const showChatInputCommandData: ApplicationCommand = {
  name: 'show',
  description: 'Show a bookmark.',
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
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'id')[0] as APIApplicationCommandInteractionDataStringOption
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
  // Resolve the bookmark
  const resolvedBookmark = await resolveBookmarkForUser(user.id, bookmarkId);
  if (!resolvedBookmark) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'The bookmark requested does not exist.',
      flags: !showOthers ? MessageFlags.Ephemeral : undefined,
    });
    return;
  }
  const bookmarkAuthor = await prisma.user.findFirst({
    where: {
      id: BigInt(resolvedBookmark.message.authorId),
    },
  });
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    embeds: [createEmbedFromBookmark(resolvedBookmark, resolvedBookmark.message, bookmarkAuthor!, resolvedBookmark.tags)],
    flags: !showOthers ? MessageFlags.Ephemeral : undefined,
    components: [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            style: ButtonStyle.Link,
            label: 'Jump to Message',
            url: getMessageLink(resolvedBookmark.message),
          },
        ],
      },
    ],
  });
}
