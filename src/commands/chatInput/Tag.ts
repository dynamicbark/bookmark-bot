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
import { upsertTag } from '../../utils/DatabaseUtils.js';

export const tagChatInputCommandData: ApplicationCommand = {
  name: 'tag',
  description: 'Tag a bookmark.',
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
      name: 'tag',
      description: 'Tag to toggle',
      required: true,
      max_length: 300,
    },
  ],
};

export async function tagChatInputCommand(interaction: APIChatInputApplicationCommandInteraction) {
  // Get the options
  const bookmarkId = (
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'id')[0] as APIApplicationCommandInteractionDataIntegerOption
  ).value;
  const tag = (
    interaction.data.options!.filter((opt) => opt.name.toLowerCase() === 'tag')[0] as APIApplicationCommandInteractionDataStringOption
  ).value.toLowerCase();
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
    include: {
      tags: true,
    },
  });
  if (!foundBookmark) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'The bookmark requested does not exist.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  if (!tag.match(/[a-z0-9_()]/g) || tag.length > 32) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'Tags must be less than 32 characters and can only contain alphanumeric characters, underscore, and parentheses.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const foundTag = await upsertTag(user.id, tag, false);
  let tagAdded = false;
  if (foundBookmark.tags.filter((t) => t.id === foundTag.id).length !== 0) {
    // Remove the tag
    await prisma.bookmark.update({
      where: {
        id: foundBookmark.id,
      },
      data: {
        tags: {
          disconnect: {
            id: foundTag.id,
          },
        },
      },
    });
  } else {
    tagAdded = true;
    // Add the tag
    await prisma.bookmark.update({
      where: {
        id: foundBookmark.id,
      },
      data: {
        tags: {
          connect: {
            id: foundTag.id,
          },
        },
      },
    });
  }
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    content: tagAdded ? `The tag \`${tag}\` was added to the bookmark.` : `The tag \`${tag}\` was removed from the bookmark.`,
    flags: MessageFlags.Ephemeral,
  });
}
