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

/* 弱→強 */
const SORTED_RANKS = [
  "LT5","HT5",
  "LT4","HT4",
  "LT3","HT3",
  "LT2","HT2",
  "LT1","HT1"
];

const STRONG_ORDER = [...SORTED_RANKS].reverse();

const TIER_RANKS = ["LT5","LT4","LT3","LT2","LT1","HT5","HT4","HT3","HT2","HT1"];

/* ===== 状態 ===== */
const MAX_PLAYERS = 5;
let queues = {};
let hosts = {};
let recruitMessages = {};
let topMessage = null;

/* 🔥 強制追加 */
let forcedPlayers = {};

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers // ←重要
  ]
});

/* ===================== */
/* 🏆 ランキング */
/* ===================== */
async function updateTopAll(guild){

  await guild.members.fetch({ force:true }); // 🔥 全取得

  const embed = new EmbedBuilder()
    .setTitle("🏆 PvPランキング")
    .setColor("#FFD700")
    .setTimestamp();

  for(const mode of TIER_MODES){

    let players = [];
    const forced = forcedPlayers[mode] || [];

    for(const member of guild.members.cache.values()){

      let best = null;

      for(const rank of STRONG_ORDER){
        const roleName = `${mode}-${rank}`;

        if(member.roles.cache.some(r =>
          r.name.toLowerCase().replace(/[_\s]/g,"-") === roleName
        )){
          best = rank;
          break;
        }
      }

      // 🔥 強制 or Tier持ち
      if(best || forced.includes(member.id)){

        if(!best && forced.includes(member.id)){
          best = "LT5"; // 最低ランク扱い
        }

        players.push({
          id: member.id,
          rank: best
        });
      }
    }

    // 🔥 ソート
    players.sort((a,b)=>{
      return STRONG_ORDER.indexOf(a.rank) - STRONG_ORDER.indexOf(b.rank);
    });

    // 🔥 表示（全員）
    let value = players.length
      ? players.map((p,i)=>`${i+1}. 【${p.rank}】 <@${p.id}>`).join("\n")
      : "⚠ Tier未設定";

    embed.addFields({
      name:`⚔ ${mode.toUpperCase()}`,
      value,
      inline:false
    });
  }

  const ch = await client.channels.fetch(TOP_CHANNEL_ID).catch(()=>null);
  if(!ch || !ch.isTextBased()) return;

  if(topMessage){
    await topMessage.edit({ embeds:[embed] });
  } else {
    topMessage = await ch.send({ embeds:[embed] });
  }
}

/* ===================== */
/* 起動 */
/* ===================== */
client.once(Events.ClientReady, async ()=>{
  console.log(`起動 ${client.user.tag}`);

  const guild = client.guilds.cache.first();
  if(!guild) return;

  await updateTopAll(guild);

  setInterval(()=>{
    updateTopAll(guild);
  }, 30000);
});

/* ===================== */
/* PvP募集 */
/* ===================== */
client.on("messageCreate", async message=>{
  if(message.author.bot) return;

  const command = message.content.toLowerCase().replace("!","");
  if(!MODES.includes(command)) return;

  queues[command] = new Set();
  hosts[command] = message.author.id;

  const ch = await client.channels.fetch(RECRUIT_CHANNEL_ID);
  if(!ch || !ch.isTextBased()) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${command}`).setLabel("参加").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${command}`).setLabel("退出").setStyle(ButtonStyle.Danger)
  );

  const msg = await ch.send({
    content:`⚔ ${command.toUpperCase()} PvP募集
主催者: <@${message.author.id}>
Q (0/${MAX_PLAYERS})`,
    components:[row]
  });

  recruitMessages[command] = msg;
});

/* ===================== */
/* Interaction */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* 手動更新 */
    if(interaction.isChatInputCommand() && interaction.commandName==="init-top"){
      await updateTopAll(interaction.guild);
      return interaction.reply({ content:"更新完了", ephemeral:true });
    }

    /* 🔥 強制追加 */
    if(interaction.commandName==="force-add"){
      const player = interaction.options.getUser("player");
      const mode = interaction.options.getString("mode");

      if(!forcedPlayers[mode]) forcedPlayers[mode] = [];

      if(!forcedPlayers[mode].includes(player.id)){
        forcedPlayers[mode].push(player.id);
      }

      await updateTopAll(interaction.guild);

      return interaction.reply({
        content:`${player} を ${mode} に追加`,
        ephemeral:true
      });
    }

    /* 🔥 強制削除 */
    if(interaction.commandName==="force-remove"){
      const player = interaction.options.getUser("player");
      const mode = interaction.options.getString("mode");

      if(forcedPlayers[mode]){
        forcedPlayers[mode] =
          forcedPlayers[mode].filter(id=>id !== player.id);
      }

      await updateTopAll(interaction.guild);

      return interaction.reply({
        content:`削除完了`,
        ephemeral:true
      });
    }

    /* PvP選択 */
    if(interaction.isChatInputCommand() && interaction.commandName==="pvp"){
      const menu = new StringSelectMenuBuilder()
        .setCustomId("pvp_select")
        .addOptions(MODES.map(m=>({label:m.toUpperCase(),value:m})));

      return interaction.reply({
        content:"モード選択",
        components:[new ActionRowBuilder().addComponents(menu)]
      });
    }

    if(interaction.isStringSelectMenu() && interaction.customId==="pvp_select"){
      const command = interaction.values[0];

      queues[command] = new Set();
      hosts[command] = interaction.user.id;

      const ch = await client.channels.fetch(RECRUIT_CHANNEL_ID);
      if(!ch || !ch.isTextBased()) return;

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`join_${command}`).setLabel("参加").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave_${command}`).setLabel("退出").setStyle(ButtonStyle.Danger)
      );

      const msg = await ch.send({
        content:`⚔ ${command.toUpperCase()} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})`,
        components:[row]
      });

      recruitMessages[command] = msg;

      return interaction.update({ content:"募集開始", components:[] });
    }

    /* Tier */
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

        for(const r of member.roles.cache.values()){
          if(r.name.startsWith(mode+"-")){
            await member.roles.remove(r);
          }
        }

        const role = interaction.guild.roles.cache.find(r=>r.name===`${mode}-${rank}`);
        if(role) await member.roles.add(role);

        await updateTopAll(interaction.guild);

        const resultChannel = await client.channels.fetch(RESULT_CHANNEL_ID);
        if(resultChannel?.isTextBased()){
          await resultChannel.send({
            content:`🏆 Tier Result
<@${playerId}> → ${mode.toUpperCase()} ${rank}`
          });
        }

        return interaction.update({ content:"完了", components:[] });
      }
    }

    /* ボタン */
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