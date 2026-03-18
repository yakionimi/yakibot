require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

/* ===== 環境変数 ===== */
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ 環境変数が設定されていません");
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

/* ===== コマンド ===== */
const commands = [

  /* 🔧 初期セットアップ */
  new SlashCommandBuilder()
    .setName("setup-ranks")
    .setDescription("TierロールとPingロールを作成"),

  /* 🏆 Tier付与 */
  new SlashCommandBuilder()
    .setName("tier")
    .setDescription("指定したプレイヤーにTier付与")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("Tierを付与するプレイヤー")
        .setRequired(true)
    ),

  /* 📊 ステータス */
  new SlashCommandBuilder()
    .setName("status")
    .setDescription("指定したプレイヤーのTier状況を確認")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("確認するプレイヤー")
        .setRequired(true)
    ),

  /* 🏆 TOP5表示 */
  new SlashCommandBuilder()
    .setName("top")
    .setDescription("指定モードのTOP5を表示")
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("モードを選択")
        .setRequired(true)
        .addChoices(
          ...MODES.map(m => ({ name: m, value: m }))
        )
    ),

  /* 🔥 ランキング生成 */
  new SlashCommandBuilder()
    .setName("init-top")
    .setDescription("ランキング表示を作成"),

  /* 🔥 強制追加コマンド（超重要） */
  new SlashCommandBuilder()
    .setName("force-add")
    .setDescription("ランキングに強制追加（バグ対策）")
    .addUserOption(option =>
      option
        .setName("player")
        .setDescription("追加するプレイヤー")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("mode")
        .setDescription("モード")
        .setRequired(true)
        .addChoices(
          ...MODES.map(m => ({ name: m, value: m }))
        )
    )
    .addStringOption(option =>
      option
        .setName("rank")
        .setDescription("ランク")
        .setRequired(true)
        .addChoices(
          { name: "HT1", value: "HT1" },
          { name: "HT2", value: "HT2" },
          { name: "HT3", value: "HT3" },
          { name: "HT4", value: "HT4" },
          { name: "HT5", value: "HT5" },
          { name: "LT1", value: "LT1" },
          { name: "LT2", value: "LT2" },
          { name: "LT3", value: "LT3" },
          { name: "LT4", value: "LT4" },
          { name: "LT5", value: "LT5" }
        )
    )

].map(cmd => cmd.toJSON());

/* ===== 登録 ===== */
const rest = new REST({ version: "10" }).setToken(TOKEN);

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