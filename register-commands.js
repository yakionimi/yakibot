require("dotenv").config();
const { REST, Routes, SlashCommandBuilder } = require("discord.js");

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const commands = [

  new SlashCommandBuilder()
    .setName("tier")
    .setDescription("Tierを設定")
    .addUserOption(o =>
      o.setName("player")
       .setDescription("対象")
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Tier確認")
    .addUserOption(o =>
      o.setName("player")
       .setDescription("対象")
       .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("init-top")
    .setDescription("ランキング更新"),

  // 👇 これ追加
  new SlashCommandBuilder()
    .setName("tier-remove")
    .setDescription("Tier削除（複数選択）")
    .addUserOption(o =>
      o.setName("player")
       .setDescription("対象")
       .setRequired(true)
    )

].map(c => c.toJSON());

const rest = new REST({ version:"10" }).setToken(TOKEN);

(async ()=>{
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body:commands }
  );
  console.log("登録完了");
})();
