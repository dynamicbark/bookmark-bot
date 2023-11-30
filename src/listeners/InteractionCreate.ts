import {
  API,
  APIInteraction,
  ApplicationCommandType,
  ComponentType,
  InteractionType,
  RESTPutAPIApplicationCommandsJSONBody,
} from '@discordjs/core';
import { searchButton } from '../commands/buttons/Search.js';
import { deleteChatInputCommand, deleteChatInputCommandData } from '../commands/chatInput/Delete.js';
import { searchChatInputCommand, searchChatInputCommandData } from '../commands/chatInput/Search.js';
import { showChatInputCommand, showChatInputCommandData } from '../commands/chatInput/Show.js';
import { tagChatInputCommand, tagChatInputCommandData } from '../commands/chatInput/Tag.js';
import { bookmarkMessageContextMenu, bookmarkMessageContextMenuData } from '../commands/messageContextMenu/Bookmark.js';
import { discordClient } from '../index.js';
import { ApplicationCommand, getUserFromInteraction } from '../utils/CommandUtils.js';
import { upsertUser } from '../utils/DatabaseUtils.js';

const chatInputCommands = new Map<string, Function>();
const messageContextMenuCommands = new Map<string, Function>();
const messageComponentButtonCommands = new Map<string, Function>();

// Register the commands
chatInputCommands.set('delete', deleteChatInputCommand);
chatInputCommands.set('search', searchChatInputCommand);
chatInputCommands.set('show', showChatInputCommand);
chatInputCommands.set('tag', tagChatInputCommand);
messageContextMenuCommands.set('bookmark', bookmarkMessageContextMenu);
messageComponentButtonCommands.set('search', searchButton);

export async function interactionCreateListener({ data: interaction, api }: { data: APIInteraction; api: API }) {
  // Commands
  if (interaction.type === InteractionType.ApplicationCommand) {
    // todo: switch this upsert to run async
    const user = getUserFromInteraction(interaction);
    await upsertUser(user.id, user.username, user.global_name, user.avatar);
    // Chat input
    if (interaction.data.type === ApplicationCommandType.ChatInput) {
      const command = chatInputCommands.get(interaction.data.name.toLowerCase());
      if (!command) {
        return;
      }
      command(interaction);
    }
    // Message (context menu)
    if (interaction.data.type === ApplicationCommandType.Message) {
      const command = messageContextMenuCommands.get(interaction.data.name.toLowerCase());
      if (!command) {
        return;
      }
      command(interaction);
    }
  }
  // Message Components
  if (interaction.type === InteractionType.MessageComponent) {
    // todo: switch this upsert to run async
    const user = getUserFromInteraction(interaction);
    await upsertUser(user.id, user.username, user.global_name, user.avatar);
    // Button
    if (interaction.data.component_type === ComponentType.Button) {
      const parsedCustomId = JSON.parse(interaction.data.custom_id);
      const command = messageComponentButtonCommands.get(parsedCustomId.t.toLowerCase());
      if (!command) {
        return;
      }
      command(interaction);
    }
  }
}

export async function registerCommandsOnDiscord(applicationId: string) {
  const globalCommands: ApplicationCommand[] = [
    deleteChatInputCommandData,
    tagChatInputCommandData,
    searchChatInputCommandData,
    showChatInputCommandData,
    bookmarkMessageContextMenuData,
  ];
  await discordClient.api.applicationCommands.bulkOverwriteGlobalCommands(
    applicationId,
    globalCommands as unknown as RESTPutAPIApplicationCommandsJSONBody,
  );
}
