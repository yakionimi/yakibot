require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");

/* ===== 環境変数 ===== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("環境変数が設定されていません");
  process.exit(1);
}

/* ===== モード ===== */
const MODES = [
  "sword",
  "mace",
  "uhc",
  "smp",
  "vanilla",
  "axe",
  "pot",
  "neth"
];

/* ===== ランク ===== */
const RANKS = [
  "HT1","HT2","HT3","HT4","HT5",
  "LT1","LT2","LT3","LT4","LT5"
];

/* ===== コマンド ===== */
const commands = [

  // Tier付与
  new SlashCommandBuilder()
    .setName("tier")
    .setDescription("プレイヤーにTier付与")
    .addUserOption(option =>
      option.setName("player")
        .setDescription("対象プレイヤー")
        .setRequired(true)
    ),

  // ランキング生成
  new SlashCommandBuilder()
    .setName("init-top")
    .setDescription("ランキング更新"),

  // 強制付与
  new SlashCommandBuilder()
    .setName("force-add")
    .setDescription("Tierを強制付与")
    .addUserOption(option =>
      option.setName("player")
        .setDescription("対象プレイヤー")
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName("mode")
        .setDescription("モード")
        .setRequired(true)
        .addChoices(...MODES.map(m => ({ name: m, value: m })))
    )
    .addStringOption(option =>
      option.setName("rank")
        .setDescription("ランク")
        .setRequired(true)
        .addChoices(...RANKS.map(r => ({ name: r, value: r })))
    )

].map(cmd => cmd.toJSON());

/* ===== 登録 ===== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("コマンド登録中...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("コマンド登録完了");
  } catch (error) {
    console.error(error);
  }
})();