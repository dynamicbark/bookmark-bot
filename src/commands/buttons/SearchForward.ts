import {
  APIMessageActionRowComponent,
  APIMessageComponentButtonInteraction,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} from '@discordjs/core';
import { discordClient, prisma } from '../../index.js';
import { getUserFromInteraction } from '../../utils/CommandUtils.js';
import { getUserAvatarUrl, standardizeMessage } from '../../utils/MessageUtils.js';

export async function searchForwardButton(interaction: APIMessageComponentButtonInteraction) {
  const parsedCustomId = JSON.parse(interaction.data.custom_id);
  const index = parsedCustomId.index;
  const foundQuery = interaction.message.content.match(/`(.*)`/gi)![0];
  const query = foundQuery.substring(1, foundQuery.length - 1) || '';
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
  let bookmarkToShow = foundBookmarks
    .filter((bookmark) => bookmark.userBookmarkId > index) // greater than the current index
    .sort((a, b) => (a.userBookmarkId > b.userBookmarkId ? 1 : -1))[0];
  if (!bookmarkToShow) {
    bookmarkToShow = foundBookmarks[0];
  }
  const isFirst = foundBookmarks[0].userBookmarkId === bookmarkToShow.userBookmarkId;
  const isLast = foundBookmarks.reverse()[0].userBookmarkId === bookmarkToShow.userBookmarkId;
  // Get the message
  const foundMessage = await prisma.message.findFirst({
    where: {
      id: BigInt(bookmarkToShow.messageId),
    },
    include: {
      author: true,
    },
  });
  if (!foundMessage) {
    console.error('the message was not found for a bookmark');
    return;
  }
  const storedMessage = standardizeMessage(foundMessage.data!.toString(), Math.floor(bookmarkToShow.updatedAt.getTime() / 1000));
  const components = [];
  if (!isFirst) {
    components.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Back',
      custom_id: JSON.stringify({
        t: 'search_back',
        index: bookmarkToShow.userBookmarkId,
      }),
    });
  }
  if (!isLast) {
    components.push({
      type: ComponentType.Button,
      style: ButtonStyle.Primary,
      label: 'Forward',
      custom_id: JSON.stringify({
        t: 'search_forward',
        index: bookmarkToShow.userBookmarkId,
      }),
    });
  }
  await discordClient.api.interactions.editReply(interaction.application_id, interaction.token, {
    content: `Search results for \`${query}\`.\n[Jump to message!](https://discord.com/channels/${storedMessage.guild_id || '@me'}/${
      storedMessage.channel_id
    }/${storedMessage.id}) (${foundBookmarks.length} result${foundBookmarks.length !== 1 ? 's' : ''})`,
    embeds: [
      {
        author: {
          name: `${foundMessage.author.username}${foundMessage.author.displayName ? ` (${foundMessage.author.displayName})` : ``}`,
          icon_url: getUserAvatarUrl(`${foundMessage.author.id}`, foundMessage.author.avatarHash),
        },
        description: storedMessage.content,
        timestamp: storedMessage.timestamp,
        footer: {
          text: `#${bookmarkToShow.userBookmarkId}`,
        },
      },
    ],
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
