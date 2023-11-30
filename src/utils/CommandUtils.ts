import { APIInteraction, APIUser, RESTPostAPIApplicationCommandsJSONBody } from '@discordjs/core';

export enum ApplicationIntegrationTypes {
  GuildInstall = 0,
  UserInstall = 1,
}

export enum ApplicationCommandContextType {
  Guild = 0,
  BotDM = 1,
  PrivateChannel = 2,
}

export type ApplicationCommand = RESTPostAPIApplicationCommandsJSONBody & {
  integration_types: ApplicationIntegrationTypes[];
  contexts: ApplicationCommandContextType[];
};

export function getUserFromInteraction(interaction: APIInteraction): APIUser {
  return interaction.user || interaction.member?.user!;
}
