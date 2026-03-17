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

/* ===== Pingロール ===== */
const MODE_MENTION_ROLES = {
  uhcpvp: "uhc-ping",
  smppvp: "smp-ping",
  swordpvp: "sword-ping",
  vanillapvp: "vanilla-ping",
  axepvp: "axe-ping",
  potpvp: "pot-ping",
  nethpvp: "neth-ping",
  macepvp: "mace-ping"
};

/* ===== Tier ===== */
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];

/* 🔥 表示用順番（修正済み） */
const SORTED_RANKS = [
  "HT1","HT2","HT3","HT4","HT5",
  "LT1","LT2","LT3","LT4","LT5"
];

const TIER_RANKS = ["LT5","LT4","LT3","LT2","LT1","HT5","HT4","HT3","HT2","HT1"];

const TIER_COLORS = {
  sword:"#55FFFF",
  mace:"#808080",
  uhc:"#FFFF00",
  smp:"#00FFFF",
  vanilla:"#FF66CC",
  axe:"#0000FF",
  pot:"#FF0000",
  neth:"#8000FF"
};

/* ===== 状態 ===== */
const MAX_PLAYERS = 5;
let queues = {};
let hosts = {};
let recruitMessages = {};
let states = {};

/* ===== TOPメッセージ ===== */
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
/* 🔥 ランキング更新（全部まとめ） */
/* ===================== */
async function updateTopAll(guild){
  const embed = new EmbedBuilder()
    .setTitle("🏆 PvPランキング")
    .setColor("#FFD700");

  for(const mode of TIER_MODES){
    let ranking = [];

    for(const rank of SORTED_RANKS){
      const role = guild.roles.cache.find(r=>r.name===`${mode}-${rank}`);
      if(role){
        for(const member of role.members.values()){
          ranking.push(`【${rank}】 <@${member.id}>`);
        }
      }
    }

    embed.addFields({
      name: `⚔ ${mode.toUpperCase()}`,
      value: ranking.slice(0,5).join("\n") || "なし",
      inline: true
    });
  }

  const ch = await client.channels.fetch(TOP_CHANNEL_ID);
  if(!ch) return;

  if(topMessage){
    await topMessage.edit({ embeds:[embed] });
  } else {
    topMessage = await ch.send({ embeds:[embed] });
  }
}

/* ===================== */
/* PvP募集処理（元のまま） */
/* ===================== */
client.on("messageCreate", async message=>{
  try{
    if(message.author.bot) return;
    const command = message.content.toLowerCase().replace("!","");
    if(!MODES.includes(command)) return;

    queues[command] = new Set();
    hosts[command] = message.author.id;
    states[command] = "recruit";

    const pingRoleName = MODE_MENTION_ROLES[command];
    const role = message.guild.roles.cache.find(r=>r.name===pingRoleName);

    const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
    if(!recruitChannel) return message.reply("チャンネル取得失敗");

    const joinBtn = new ButtonBuilder()
      .setCustomId(`join_${command}`)
      .setLabel("参加")
      .setStyle(ButtonStyle.Success);

    const leaveBtn = new ButtonBuilder()
      .setCustomId(`leave_${command}`)
      .setLabel("退出")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(joinBtn,leaveBtn);

    const msg = await recruitChannel.send({
      content:`${role ? `<@&${role.id}>` : ""}
⚔ ${command.toUpperCase()} PvP募集
主催者: <@${message.author.id}>
Q (0/${MAX_PLAYERS})
まだ誰もいません`,
      components:[row]
    });

    recruitMessages[command] = msg;

    const startBtn = new ButtonBuilder()
      .setCustomId(`start_${command}`)
      .setLabel("開始")
      .setStyle(ButtonStyle.Primary);

    const endBtn = new ButtonBuilder()
      .setCustomId(`end_${command}`)
      .setLabel("終了")
      .setStyle(ButtonStyle.Secondary);

    const controlRow = new ActionRowBuilder().addComponents(startBtn,endBtn);

    await message.channel.send({
      content:`${command.toUpperCase()} 管理`,
      components:[controlRow]
    });

  }catch(err){
    console.error(err);
  }
});

/* ===================== */
/* Interaction処理 */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* ===== init-top ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="init-top"){
      await updateTopAll(interaction.guild);
      return interaction.reply({ content:"ランキング生成", ephemeral:true });
    }

    /* ===== setup-ranks ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="setup-ranks"){
      let created=[];
      for(const mode of TIER_MODES){
        for(const rank of TIER_RANKS){
          const name = `${mode}-${rank}`;
          const exists = interaction.guild.roles.cache.find(r=>r.name===name);
          if(!exists){
            const role = await interaction.guild.roles.create({
              name:name,
              color:TIER_COLORS[mode]
            });
            created.push(role.name);
          }
        }
      }
      for(const key in MODE_MENTION_ROLES){
        const name = MODE_MENTION_ROLES[key];
        const exists = interaction.guild.roles.cache.find(r=>r.name===name);
        if(!exists){
          const role = await interaction.guild.roles.create({name:name});
          created.push(role.name);
        }
      }
      return interaction.reply({
        content:`作成ロール\n${created.join("\n")}`,
        ephemeral:true
      });
    }

    /* ===== tier ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="tier"){
      const player = interaction.options.getUser("player");

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`tier_mode_${player.id}_${interaction.user.id}`)
        .setPlaceholder("モード選択")
        .addOptions(TIER_MODES.map(m=>({label:m,value:m})));

      return interaction.reply({
        content:`${player} のPvPモード`,
        components:[new ActionRowBuilder().addComponents(menu)],
        ephemeral:true
      });
    }

    /* ===== status ===== */
    if(interaction.isChatInputCommand() && interaction.commandName==="status"){
      const player = interaction.options.getUser("player");
      const member = await interaction.guild.members.fetch(player.id);

      let results = [];
      for(const mode of TIER_MODES){
        for(const rank of TIER_RANKS){
          const roleName = `${mode}-${rank}`;
          const role = interaction.guild.roles.cache.find(r=>r.name===roleName);
          if(role && member.roles.cache.has(role.id)){
            results.push(`${mode.toUpperCase()} : ${rank}`);
          }
        }
      }

      if(results.length===0){
        results.push("まだTierが設定されていません");
      }

      return interaction.reply({
        content:`📊 ${player} のPvPステータス\n${results.join("\n")}`,
        ephemeral:false
      });
    }

    /* ===== Tier選択 ===== */
    if(interaction.isStringSelectMenu()){

      if(interaction.customId.startsWith("tier_mode_")){
        const data = interaction.customId.split("_");
        const playerId = data[2];
        const executorId = data[3];
        const mode = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`tier_rank_${playerId}_${mode}_${executorId}`)
          .setPlaceholder("Tier")
          .addOptions(TIER_RANKS.map(r=>({label:r,value:r})));

        return interaction.update({
          content:`Tier選択 (${mode})`,
          components:[new ActionRowBuilder().addComponents(menu)]
        });
      }

      if(interaction.customId.startsWith("tier_rank_")){
        const data = interaction.customId.split("_");
        const playerId = data[2];
        const mode = data[3];
        const executorId = data[4];
        const rank = interaction.values[0];

        const member = await interaction.guild.members.fetch(playerId);

        // 🔥 同モード上書き
        for(const r of member.roles.cache.values()){
          if(r.name.startsWith(mode + "-")){
            await member.roles.remove(r);
          }
        }

        const role = interaction.guild.roles.cache.find(r=>r.name===`${mode}-${rank}`);
        if(role) await member.roles.add(role);

        // 🔥 ランキング更新（追加部分）
        await updateTopAll(interaction.guild);

        const resultChannel = await client.channels.fetch(RESULT_CHANNEL_ID);
        if(resultChannel){
          await resultChannel.send({
            content:`🏆 Tier Result\nPlayer : <@${playerId}>\nMode : ${mode.toUpperCase()}\nTier : ${rank}\nTester : <@${executorId}>`
          });
        }

        return interaction.update({
          content:`${member} に ${mode}-${rank} 付与`,
          components:[]
        });
      }
    }

    /* ===== PvPボタン（元のまま） ===== */
    if(interaction.isButton()){
      const [action,mode] = interaction.customId.split("_");
      if(!queues[mode]) return;

      const players = queues[mode];

      if(action==="join"){
        if(states[mode]!=="recruit") return interaction.reply({content:"募集ロック中",ephemeral:true});
        if(players.size>=MAX_PLAYERS) return interaction.reply({content:"満員",ephemeral:true});
        players.add(interaction.user.id);
      }

      if(action==="leave"){
        if(states[mode]!=="recruit") return interaction.reply({content:"募集ロック中",ephemeral:true});
        players.delete(interaction.user.id);
      }

      if(action==="start"){
        if(interaction.user.id!==hosts[mode]) return interaction.reply({content:"主催者のみ",ephemeral:true});
        states[mode]="locked";

        const list = [...players].map(id=>`<@${id}>`).join("\n") || "誰もいません";

        await recruitMessages[mode].edit({
          content:`🔒 ${mode.toUpperCase()} PvP開始\n\n${list}`,
          components:[]
        });

        return interaction.reply({content:"試合開始",ephemeral:true});
      }

      if(action==="end"){
        if(interaction.user.id!==hosts[mode]) return interaction.reply({content:"主催者のみ",ephemeral:true});
        states[mode]="ended";

        await recruitMessages[mode].edit({
          content:`❌ ${mode.toUpperCase()} 募集終了`,
          components:[]
        });

        players.clear();
        return interaction.reply({content:"終了",ephemeral:true});
      }

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
    if(!interaction.replied){
      interaction.reply({content:"エラー発生",ephemeral:true});
    }
  }
});

client.login(TOKEN);