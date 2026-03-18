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

/* 強い順 */
const RANK_ORDER = [
  "HT1","LT1",
  "HT2","LT2",
  "HT3","LT3",
  "HT4","LT4",
  "HT5","LT5"
];

const TIER_RANKS = ["LT5","LT4","LT3","LT2","LT1","HT5","HT4","HT3","HT2","HT1"];

/* ===== 状態 ===== */
const MAX_PLAYERS = 5;
let queues = {};
let hosts = {};
let recruitMessages = {};
let topMessage = null;

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

/* ===================== */
/* 🏆 ランキング（修正版） */
/* ===================== */
async function updateTopAll(guild){

  await guild.members.fetch();

  const embed = new EmbedBuilder()
    .setTitle("🏆 PvPランキング")
    .setColor("#FFD700")
    .setTimestamp();

  for(const mode of TIER_MODES){

    let players = [];

    for(const member of guild.members.cache.values()){

      let best = null;

      for(const rank of RANK_ORDER){
        if(member.roles.cache.some(r=>r.name === `${mode}-${rank}`)){
          best = rank;
          break;
        }
      }

      if(best){
        players.push({ id: member.id, rank: best });
      }
    }

    players.sort((a,b)=>{
      return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
    });

    let value = players.length
      ? players.slice(0,5)
          .map((p,i)=>`${i+1}. 【${p.rank}】 <@${p.id}>`)
          .join("\n")
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
  }else{
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
/* PvP募集（そのまま） */
/* ===================== */
client.on("messageCreate", async message=>{
  if(message.author.bot) return;

  const command = message.content.toLowerCase().replace("!","");
  if(!MODES.includes(command)) return;

  queues[command] = new Set();
  hosts[command] = message.author.id;

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

    if(interaction.commandName==="init-top"){
      await updateTopAll(interaction.guild);
      return interaction.reply({ content:"更新完了", ephemeral:true });
    }

    if(interaction.commandName==="tier"){
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
Player : <@${playerId}>
Mode : ${mode.toUpperCase()}
Tier : ${rank}
Tester : <@${executorId}>`
          });
        }

        return interaction.update({ content:"付与完了", components:[] });
      }
    }

    /* PvPボタン */
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

      return interaction.reply({ content:"更新", ephemeral:true });
    }

  }catch(err){
    console.error(err);
  }
});

client.login(TOKEN);