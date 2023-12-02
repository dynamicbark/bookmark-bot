import {
  APIApplicationCommandInteractionDataStringOption,
  APIChatInputApplicationCommandInteraction,
  APIMessageActionRowComponent,
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
import { createEmbedFromBookmark, getMessageLink } from '../../utils/MessageUtils.js';

export const searchChatInputCommandData: ApplicationCommand = {
  name: 'search',
  description: 'Search for a bookmark.',
  type: ApplicationCommandType.ChatInput,
  integration_types: [ApplicationIntegrationTypes.UserInstall],
  contexts: [ApplicationCommandContextType.BotDM, ApplicationCommandContextType.Guild, ApplicationCommandContextType.PrivateChannel],
  options: [
    {
      type: ApplicationCommandOptionType.String,
      name: 'query',
      description: 'The search query to use.',
      required: false,
      max_length: 300,
    },
    {
      type: ApplicationCommandOptionType.String,
      name: 'tags',
      description: 'The tags to filter by (space seperated)',
      required: false,
      max_length: 300,
    },
  ],
};

export async function searchChatInputCommand(interaction: APIChatInputApplicationCommandInteraction) {
  // Get the options
  let queryOption =
    (
      interaction.data.options?.filter((opt) => opt.name.toLowerCase() === 'query')[0] as
        | APIApplicationCommandInteractionDataStringOption
        | undefined
    )?.value
      .replaceAll('`', '')
      .replaceAll('\n', '')
      .trim() || '';
  const tagsOption =
    (
      interaction.data.options?.filter((opt) => opt.name.toLowerCase() === 'tags')[0] as
        | APIApplicationCommandInteractionDataStringOption
        | undefined
    )?.value.trim() || '';
  // Defer the reply since it can take some time to process
  await discordClient.api.interactions.defer(interaction.id, interaction.token, {
    flags: MessageFlags.Ephemeral,
  });
  const user = getUserFromInteraction(interaction);
  // Get all the bookmarks for a user
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      userId: BigInt(user.id),
    },
    include: {
      tags: true,
      message: true,
    },
  });
  //const matchStartingTags = /^#([a-z0-9:_()]{1,}) ?(?:(?:.|\n)*)/;
  const tagsToSearch = new Set<string>();
  for (let tagName of tagsOption.split(' ')) {
    tagName = tagName.toLowerCase().trim();
    if (tagName !== '') {
      tagsToSearch.add(tagName);
    }
  }
  const foundBookmarks = [];
  for (const bookmark of bookmarks) {
    let shouldStop = false;
    for (const tagName of tagsToSearch) {
      if (!bookmark.tags.find((t) => t.name === tagName)) {
        shouldStop = true;
        break;
      }
    }
    if (shouldStop) {
      continue;
    }
    const messageData = JSON.parse(bookmark.message.data!.toString());
    if (messageData.content.toLowerCase().includes(queryOption)) {
      foundBookmarks.push(bookmark);
    }
  }
  if (foundBookmarks.length < 1) {
    await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
      content: 'No results were found.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
  const bookmarkToShow = foundBookmarks[0];
  const components = [
    {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Back',
      custom_id: JSON.stringify({
        t: 'search',
        mode: 'back',
        // Loop to last
        index: foundBookmarks[0].userBookmarkId !== bookmarkToShow.userBookmarkId ? bookmarkToShow.userBookmarkId : 100_000_000,
      }),
    },
    {
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: 'Jump to Message',
      url: getMessageLink(bookmarkToShow.message),
    },
    {
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Forward',
      custom_id: JSON.stringify({
        t: 'search',
        mode: 'forward',
        // Loop to first
        index: foundBookmarks.reverse()[0].userBookmarkId !== bookmarkToShow.userBookmarkId ? bookmarkToShow.userBookmarkId : -1,
      }),
    },
  ];
  const bookmarkAuthor = await prisma.user.findFirst({
    where: {
      id: BigInt(bookmarkToShow.message.authorId),
    },
  });
  let builtQuery = ([...tagsToSearch].map((tag) => `#${tag}`).join(' ') + ` ${queryOption}`).trim();
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    content: `Search results for \`${builtQuery === '' ? '*' : builtQuery}\`. (${foundBookmarks.length} result${
      foundBookmarks.length !== 1 ? 's' : ''
    })`,
    embeds: [createEmbedFromBookmark(bookmarkToShow, bookmarkToShow.message, bookmarkAuthor!, bookmarkToShow.tags)],
    components:
      components.length !== 0
        ? [
            {
              type: ComponentType.ActionRow,
              components: components as APIMessageActionRowComponent[],
            },
          ]
        : undefined,
    flags: MessageFlags.Ephemeral,
  });
}
