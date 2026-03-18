require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.TOKEN;
const RECRUIT_CHANNEL_ID = "1482990303475531796";
const RESULT_CHANNEL_ID = "1483020005183324250";
const TOP_CHANNEL_ID = "1483431155792347186";

/* ===== PvPモード ===== */
const MODES = ["uhcpvp","smppvp","swordpvp","vanillapvp","axepvp","potpvp","nethpvp","macepvp"];

/* ===== Tier ===== */
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];

/* 🔥 並び（弱→強） */
const SORTED_RANKS = [
  "LT5","HT5",
  "LT4","HT4",
  "LT3","HT3",
  "LT2","HT2",
  "LT1","HT1"
];

const TIER_RANKS = ["LT5","LT4","LT3","LT2","LT1","HT5","HT4","HT3","HT2","HT1"];

/* ===== 状態 ===== */
const MAX_PLAYERS = 5;
let queues = {};
let hosts = {};
let recruitMessages = {};
let states = {};
let topMessage = null;

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, ()=>{
  console.log(`起動 ${client.user.tag}`);
});

/* ===================== */
/* 🏆 ランキング（完成版） */
/* ===================== */
async function updateTopAll(guild){
  console.log("=== ランキング更新 ===");

  const embed = new EmbedBuilder()
    .setTitle("🏆 PvPランキング")
    .setColor("#FFD700");

  for(const mode of TIER_MODES){
    let ranking = [];

    for(const rank of SORTED_RANKS){
      const roleName = `${mode}-${rank}`;
      const role = guild.roles.cache.find(r=>r.name === roleName);

      if(!role) continue;

      for(const member of role.members.values()){
        ranking.push(`【${rank}】 <@${member.id}>`);
      }
    }

    // 🔥 強い順にして順位つける
    let value = ranking.length
      ? ranking
          .reverse()
          .slice(0,5)
          .map((v,i)=>`${i+1}. ${v}`)
          .join("\n")
      : "⚠ Tier未設定";

    embed.addFields({
      name: `⚔ ${mode.toUpperCase()}`,
      value: value,
      inline: false
    });
  }

  let ch;
  try{
    ch = await client.channels.fetch(TOP_CHANNEL_ID);
  }catch{
    console.log("❌ チャンネル取得失敗");
    return;
  }

  if(!ch || !ch.isTextBased()) return;

  if(topMessage){
    await topMessage.edit({ embeds:[embed] });
  } else {
    topMessage = await ch.send({ embeds:[embed] });
  }
}

/* ===================== */
/* PvP（コマンド式） */
/* ===================== */
client.on("messageCreate", async message=>{
  if(message.author.bot) return;

  const command = message.content.toLowerCase().replace("!","");
  if(!MODES.includes(command)) return;

  queues[command] = new Set();
  hosts[command] = message.author.id;
  states[command] = "recruit";

  const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
  if(!recruitChannel || !recruitChannel.isTextBased()) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${command}`).setLabel("参加").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${command}`).setLabel("退出").setStyle(ButtonStyle.Danger)
  );

  const msg = await recruitChannel.send({
    content:`⚔ ${command.toUpperCase()} PvP募集
主催者: <@${message.author.id}>
Q (0/${MAX_PLAYERS})
まだ誰もいません`,
    components:[row]
  });

  recruitMessages[command] = msg;
});

/* ===================== */
/* Interaction */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* ===== init-top ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="init-top"){
      await updateTopAll(interaction.guild);
      return interaction.reply({ content:"ランキング生成OK", ephemeral:true });
    }

    /* ===== pvp（選択式） ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="pvp"){
      const menu = new StringSelectMenuBuilder()
        .setCustomId("pvp_select")
        .setPlaceholder("モード選択")
        .addOptions(MODES.map(m=>({
          label:m.toUpperCase(),
          value:m
        })));

      return interaction.reply({
        content:"PvPモード選択",
        components:[new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ===== PvP選択後 ===== */
    if(interaction.isStringSelectMenu() && interaction.customId==="pvp_select"){
      const command = interaction.values[0];

      queues[command] = new Set();
      hosts[command] = interaction.user.id;
      states[command] = "recruit";

      const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
      if(!recruitChannel || !recruitChannel.isTextBased()) return;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`join_${command}`).setLabel("参加").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave_${command}`).setLabel("退出").setStyle(ButtonStyle.Danger)
      );

      const msg = await recruitChannel.send({
        content:`⚔ ${command.toUpperCase()} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})
まだ誰もいません`,
        components:[row]
      });

      recruitMessages[command] = msg;

      return interaction.update({
        content:`${command.toUpperCase()} 募集開始`,
        components:[]
      });
    }

    /* ===== Tier ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="tier"){
      const player = interaction.options.getUser("player");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`tier_mode_${player.id}_${interaction.user.id}`)
        .addOptions(TIER_MODES.map(m=>({label:m,value:m})));

      return interaction.reply({
        content:`${player} のモード選択`,
        components:[new ActionRowBuilder().addComponents(menu)],
        ephemeral:true
      });
    }

    /* ===== Tier処理 ===== */
    if(interaction.isStringSelectMenu()){

      if(interaction.customId.startsWith("tier_mode_")){
        const [_,__,playerId,executorId] = interaction.customId.split("_");
        const mode = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`tier_rank_${playerId}_${mode}_${executorId}`)
          .addOptions(TIER_RANKS.map(r=>({label:r,value:r})));

        return interaction.update({
          content:`Tier選択 (${mode})`,
          components:[new ActionRowBuilder().addComponents(menu)]
        });
      }

      if(interaction.customId.startsWith("tier_rank_")){
        const [_,__,playerId,mode,executorId] = interaction.customId.split("_");
        const rank = interaction.values[0];

        const member = await interaction.guild.members.fetch(playerId);

        // 上書き
        for(const r of member.roles.cache.values()){
          if(r.name.startsWith(mode+"-")){
            await member.roles.remove(r);
          }
        }

        const role = interaction.guild.roles.cache.find(r=>r.name===`${mode}-${rank}`);
        if(role) await member.roles.add(role);

        await updateTopAll(interaction.guild);

        const resultChannel = await client.channels.fetch(RESULT_CHANNEL_ID);
        if(resultChannel && resultChannel.isTextBased()){
          await resultChannel.send({
            content:`🏆 Tier Result
Player : <@${playerId}>
Mode : ${mode.toUpperCase()}
Tier : ${rank}
Tester : <@${executorId}>`
          });
        }

        return interaction.update({
          content:`付与完了`,
          components:[]
        });
      }
    }

    /* ===== PvPボタン ===== */
    if(interaction.isButton()){
      const [action,mode] = interaction.customId.split("_");

      if(!queues[mode]) return;

      const players = queues[mode];

      if(action==="join") players.add(interaction.user.id);
      if(action==="leave") players.delete(interaction.user.id);

      const list = players.size
        ? [...players].map(id=>`<@${id}>`).join("\n")
        : "まだ誰もいません";

      await recruitMessages[mode].edit({
        content:`⚔ ${mode.toUpperCase()} PvP募集
主催者: <@${hosts[mode]}>
Q (${players.size}/${MAX_PLAYERS})
${list}`
      });

      return interaction.reply({content:"更新",ephemeral:true});
    }

  }catch(err){
    console.error(err);
  }
});

client.login(TOKEN);