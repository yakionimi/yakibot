require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

// 🔒 環境変数から取得
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// 環境変数チェック（デバッグ用）
if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ 環境変数が設定されていません");
  process.exit(1);
}

// コマンド定義
const commands = [
  new SlashCommandBuilder()
    .setName("setup-ranks")
    .setDescription("TierロールとPingロールを作成"),

  new SlashCommandBuilder()
    .setName("tier")
    .setDescription("指定したプレイヤーにTier付与")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Tierを付与するプレイヤー")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("指定したプレイヤーのTier状況を確認")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("ステータスを確認するプレイヤー")
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// REST登録
const rest = new REST({ version: "10" }).setToken(TOKEN);

// 実行
(async () => {
  try {
    console.log("🔄 コマンド登録中...");

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log("✅ コマンド登録完了");
  } catch (error) {
    console.error("❌ コマンド登録失敗", error);
  }
})();