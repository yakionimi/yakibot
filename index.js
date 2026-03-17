const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

require("dotenv").config();
const TOKEN = process.env.TOKEN;
let players = new Set();

client.once("ready", () => {
  console.log(`起動: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // PvP募集
  if (message.content === "!pvp") {

    players.clear();

    const joinBtn = new ButtonBuilder()
      .setCustomId("join")
      .setLabel("参加")
      .setStyle(ButtonStyle.Success);

    const leaveBtn = new ButtonBuilder()
      .setCustomId("leave")
      .setLabel("退出")
      .setStyle(ButtonStyle.Danger);

    const startBtn = new ButtonBuilder()
      .setCustomId("start")
      .setLabel("開始")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(joinBtn, leaveBtn, startBtn);

    message.channel.send({
      content: "⚔ **PvP参加者募集！**\n\n参加ボタンを押してね",
      components: [row]
    });
  }
});

client.on(Events.InteractionCreate, async (interaction) => {

  if (!interaction.isButton()) return;

  const user = interaction.user;

  if (interaction.customId === "join") {

    players.add(user.id);

    await interaction.reply({
      content: `✅ 参加しました (${players.size}人)`,
      ephemeral: true
    });

  }

  if (interaction.customId === "leave") {

    players.delete(user.id);

    await interaction.reply({
      content: `❌ 退出しました (${players.size}人)`,
      ephemeral: true
    });

  }

  if (interaction.customId === "start") {

    if (players.size < 2) {
      interaction.reply({
        content: "⚠ 最低2人必要",
        ephemeral: true
      });
      return;
    }

    const list = [...players].map(id => `<@${id}>`).join("\n");

    interaction.reply({
      content: `🔥 PvP開始！\n\n参加者:\n${list}`
    });

    players.clear();
  }

});

client.login(TOKEN);