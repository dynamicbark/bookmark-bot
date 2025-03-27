import { APIInteraction, APIUser, RESTPostAPIApplicationCommandsJSONBody } from '@discordjs/core';

export type ApplicationCommand = RESTPostAPIApplicationCommandsJSONBody;

export function getUserFromInteraction(interaction: APIInteraction): APIUser {
  return interaction.user || interaction.member?.user!;
}
