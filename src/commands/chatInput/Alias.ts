import {
  APIApplicationCommandInteractionDataIntegerOption,
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

export const aliasChatInputCommandData: ApplicationCommand = {
  name: 'alias',
  description: 'Alias a bookmark.',
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
      type: ApplicationCommandOptionType.String,
      name: 'new_alias',
      description: 'Alias to set, ignore to unset',
      required: false,
      max_length: 32,
    },
  ],
};

export async function aliasChatInputCommand(interaction: APIChatInputApplicationCommandInteraction) {
  // Get the options
  const bookmarkId = (
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'id')[0] as APIApplicationCommandInteractionDataIntegerOption
  ).value;
  let alias =
    (
      interaction.data.options!.filter(
        (opt) => opt.name.toLowerCase() === 'new_alias',
      )[0] as APIApplicationCommandInteractionDataStringOption
    )?.value.toLowerCase() || undefined;
  // Defer the reply since it can take some time to process
  await discordClient.api.interactions.defer(interaction.id, interaction.token, {
    flags: MessageFlags.Ephemeral,
  });
  const user = getUserFromInteraction(interaction);
  // Check if it has been bookmarked by the user
  const resolvedBookmark = await resolveBookmarkForUser(user.id, `${bookmarkId}`);
  if (!resolvedBookmark) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'The bookmark requested does not exist.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (alias && alias !== resolvedBookmark.alias) {
    if (alias.match(/^[0-9]+$/g)) {
      await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
        content: 'Aliases cannot be only numbers.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (!alias.match(/[a-z0-9_()]/g) || alias.length > 32) {
      await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
        content: 'Aliases must be less than 32 characters and can only contain alphanumeric characters, underscore, and parentheses.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const foundOtherBookmark = await resolveBookmarkForUser(user.id, alias);
    if (foundOtherBookmark) {
      await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
        content: 'You already used this alias on another bookmark.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await prisma.bookmark.update({
      where: {
        id: resolvedBookmark.id,
      },
      data: {
        alias,
      },
    });
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: `The alias \`${alias}\` was set on the bookmark.`,
      flags: MessageFlags.Ephemeral,
    });
  } else {
    await prisma.bookmark.update({
      where: {
        id: resolvedBookmark.id,
      },
      data: {
        alias: null,
      },
    });
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: `The alias was removed from the bookmark.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
