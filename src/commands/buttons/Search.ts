import {
  APIMessageActionRowComponent,
  APIMessageComponentButtonInteraction,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from '@discordjs/core';
import { discordClient, prisma } from '../../index.js';
import { getUserFromInteraction } from '../../utils/CommandUtils.js';
import { createEmbedFromBookmark } from '../../utils/MessageUtils.js';

export async function searchButton(interaction: APIMessageComponentButtonInteraction) {
  const parsedCustomId = JSON.parse(interaction.data.custom_id);
  const mode: 'forward' | 'back' = parsedCustomId.mode;
  const index = parsedCustomId.index;
  const foundQuery = interaction.message.content.match(/`(.*)`/gi)![0];
  let query = foundQuery.substring(1, foundQuery.length - 1) || '';
  if (query === '*') {
    query = '';
  }
  // Defer the update since it can take some time to process
  await discordClient.api.interactions.deferMessageUpdate(interaction.id, interaction.token, {});
  //
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
  const matchStartingTags = /^#([a-z0-9:_()]{1,}) ?(?:(?:.|\n)*)/;
  const tagsToSearch = new Set<string>();
  let updatedQuery = query.trim();
  while (true) {
    const matches = updatedQuery.match(matchStartingTags);
    if (!matches) {
      break;
    }
    const foundTag = matches[1];
    tagsToSearch.add(foundTag);
    updatedQuery = updatedQuery.substring(`#${foundTag}`.length).trim();
  }
  const foundBookmarks = [];
  for (const bookmark of bookmarks) {
    let shouldStop = false;
    for (const tagName of tagsToSearch) {
      if (!bookmark.tags.find((t) => t.name === tagName.toLowerCase())) {
        shouldStop = true;
        break;
      }
    }
    if (shouldStop) {
      continue;
    }
    const messageData = JSON.parse(bookmark.message.data!.toString());
    if (messageData.content.toLowerCase().includes(updatedQuery)) {
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
  // Get the bookmark to show
  let bookmarkToShow = undefined;
  if (mode === 'forward') {
    bookmarkToShow = foundBookmarks
      .filter((bookmark) => bookmark.userBookmarkId > index) // greater than the current index
      .sort((a, b) => (a.userBookmarkId > b.userBookmarkId ? 1 : -1))[0];
  } else if (mode === 'back') {
    bookmarkToShow = foundBookmarks
      .filter((bookmark) => bookmark.userBookmarkId < index) // less than the current index
      .sort((a, b) => (a.userBookmarkId > b.userBookmarkId ? 1 : -1))
      .reverse()[0];
  }
  if (!bookmarkToShow) {
    bookmarkToShow = foundBookmarks[0];
  }
  const components = [];
  if (foundBookmarks[0].userBookmarkId !== bookmarkToShow.userBookmarkId) {
    // is first
    components.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Back',
      custom_id: JSON.stringify({
        t: 'search',
        mode: 'back',
        index: bookmarkToShow.userBookmarkId,
      }),
    });
  }
  if (foundBookmarks.reverse()[0].userBookmarkId !== bookmarkToShow.userBookmarkId) {
    // is last
    components.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Forward',
      custom_id: JSON.stringify({
        t: 'search',
        mode: 'forward',
        index: bookmarkToShow.userBookmarkId,
      }),
    });
  }
  const bookmarkAuthor = await prisma.user.findFirst({
    where: {
      id: BigInt(bookmarkToShow.message.authorId),
    },
  });
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    content: `Search results for \`${query === '' ? '*' : query}\`. (${foundBookmarks.length} result${
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
