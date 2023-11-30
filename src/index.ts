import { Client, GatewayDispatchEvents, GatewayReadyDispatchData, WithIntrinsicProps } from '@discordjs/core';
import { REST } from '@discordjs/rest';
import { WebSocketManager } from '@discordjs/ws';
import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { interactionCreateListener, registerCommandsOnDiscord } from './listeners/InteractionCreate.js';

export const prisma = new PrismaClient();

const discordRest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

const discordGateway = new WebSocketManager({
  token: process.env.DISCORD_TOKEN!,
  intents: 0, // No intents
  rest: discordRest,
});

export const discordClient = new Client({ rest: discordRest, gateway: discordGateway });

discordClient.on(GatewayDispatchEvents.InteractionCreate, interactionCreateListener);
discordClient.once(GatewayDispatchEvents.Ready, async (readyDispatchData: WithIntrinsicProps<GatewayReadyDispatchData>) => {
  if (process.env.REGISTER_COMMANDS_ON_DISCORD == 'true') {
    await registerCommandsOnDiscord(readyDispatchData.data.application.id);
  }
  console.log('Ready!');
});

async function main() {
  await prisma.$connect();
  discordGateway.connect();
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    // disconnect
    await prisma.$disconnect();
  });
