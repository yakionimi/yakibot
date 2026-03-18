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

const MODES = ["uhcpvp","smppvp","swordpvp","vanillapvp","axepvp","potpvp","nethpvp","macepvp"];
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];

const RANK_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
const TIER_RANKS = ["LT5","LT4","LT3","LT2","LT1","HT5","HT4","HT3","HT2","HT1"];

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


// =====================
// 🏆 ランキング
// =====================
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

    players.sort((a,b)=> RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

    let value = players.length
      ? players.slice(0,5).map((p,i)=>`${i+1}. 【${p.rank}】 <@${p.id}>`).join("\n")
      : "⚠ Tier未設定";

    embed.addFields({ name:`⚔ ${mode.toUpperCase()}`, value });
  }

  const ch = await client.channels.fetch(TOP_CHANNEL_ID).catch(()=>null);
  if(!ch || !ch.isTextBased()) return;

  if(topMessage){
    await topMessage.edit({ embeds:[embed] });
  }else{
    topMessage = await ch.send({ embeds:[embed] });
  }
}


// =====================
// 起動
// =====================
client.once(Events.ClientReady, async ()=>{
  console.log(`起動 ${client.user.tag}`);
  const guild = client.guilds.cache.first();
  if(!guild) return;

  await updateTopAll(guild);

  setInterval(()=>{
    updateTopAll(guild);
  }, 300000); // 5分
});


// =====================
// !pvp → モード選択
// =====================
client.on("messageCreate", async message=>{
  if(message.author.bot) return;

  if(message.content === "!pvp"){
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`pvp_select_${message.author.id}`)
      .setPlaceholder("モード選択")
      .addOptions(MODES.map(m=>({
        label: m.toUpperCase(),
        value: m
      })));

    return message.reply({
      content:"⚔ モードを選択",
      components:[new ActionRowBuilder().addComponents(menu)]
    });
  }
});


// =====================
// Interaction
// =====================
client.on(Events.InteractionCreate, async interaction=>{
  try{

    // ===== モード選択 → 募集開始ボタン =====
    if(interaction.isStringSelectMenu()){
      if(interaction.customId.startsWith("pvp_select_")){
        const userId = interaction.customId.split("_")[2];
        if(interaction.user.id !== userId){
          return interaction.reply({ content:"操作不可", ephemeral:true });
        }

        const mode = interaction.values[0];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`start_${mode}_${userId}`)
            .setLabel("募集開始")
            .setStyle(ButtonStyle.Primary)
        );

        return interaction.update({
          content:`⚔ ${mode.toUpperCase()} を選択`,
          components:[row]
        });
      }
    }

    // ===== ボタン処理 =====
    if(interaction.isButton()){
      const [action,mode,userId] = interaction.customId.split("_");

      // ===== 募集開始 =====
      if(action === "start"){
        if(interaction.user.id !== userId){
          return interaction.reply({ content:"操作不可", ephemeral:true });
        }

        queues[mode] = new Set();
        hosts[mode] = interaction.user.id;

        const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
        if(!recruitChannel || !recruitChannel.isTextBased()) return;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${mode}`).setLabel("参加").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_${mode}`).setLabel("退出").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`end_${mode}`).setLabel("募集終了").setStyle(ButtonStyle.Secondary)
        );

        const msg = await recruitChannel.send({
          content:`⚔ ${mode.toUpperCase()} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})

まだ誰もいません`,
          components:[row]
        });

        recruitMessages[mode] = msg;

        return interaction.update({
          content:"✅ 募集開始",
          components:[]
        });
      }

      // ===== 参加 / 退出 =====
      if(action === "join" || action === "leave"){
        if(!queues[mode]) return;

        const players = queues[mode];

        if(action==="join") players.add(interaction.user.id);
        if(action==="leave") players.delete(interaction.user.id);

        const list = players.size
          ? [...players].map(id=>`<@${id}>`).join("\n")
          : "まだ誰もいません";

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${mode}`).setLabel("参加").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_${mode}`).setLabel("退出").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`end_${mode}`).setLabel("募集終了").setStyle(ButtonStyle.Secondary)
        );

        await recruitMessages[mode].edit({
          content:`⚔ ${mode.toUpperCase()} PvP募集
主催者: <@${hosts[mode]}>
Q (${players.size}/${MAX_PLAYERS})

${list}`,
          components:[row]
        });

        return interaction.reply({ content:"更新", ephemeral:true });
      }

      // ===== 募集終了 =====
      if(action === "end"){
        if(interaction.user.id !== hosts[mode]){
          return interaction.reply({ content:"主催者のみ終了可", ephemeral:true });
        }

        const players = queues[mode] || new Set();

        const list = players.size
          ? [...players].map(id=>`<@${id}>`).join("\n")
          : "誰もいません";

        await recruitMessages[mode].edit({
          content:`🛑 ${mode.toUpperCase()} 募集終了
主催者: <@${hosts[mode]}>
参加者 (${players.size})

${list}`,
          components:[]
        });

        delete queues[mode];
        delete hosts[mode];
        delete recruitMessages[mode];

        return interaction.reply({ content:"終了しました", ephemeral:true });
      }
    }

  }catch(err){
    console.error(err);
  }
});

client.login(TOKEN);