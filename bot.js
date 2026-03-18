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
const TOP_CHANNEL_ID = "1483431155792347186";

const MODES = ["uhcpvp","smppvp","swordpvp","vanillapvp","axepvp","potpvp","nethpvp","macepvp"];
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];

const RANK_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];

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
  }, 300000);
});


// =====================
// !pvp → モード選択（誰でもOK）
// =====================
client.on("messageCreate", async message=>{
  if(message.author.bot) return;

  if(message.content === "!pvp"){
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`pvp_select_${Date.now()}`) // ←ここが重要（毎回ユニーク）
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

    // ===== モード選択 → 募集開始 =====
    if(interaction.isStringSelectMenu()){
      if(interaction.customId.startsWith("pvp_select_")){
        const mode = interaction.values[0];

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`start_${mode}_${Date.now()}`) // ←ユニーク
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
      const [action,mode,id] = interaction.customId.split("_");

      // ===== 募集開始 =====
      if(action === "start"){
        const key = `${mode}_${Date.now()}`;

        queues[key] = new Set();
        hosts[key] = interaction.user.id;

        const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);
        if(!recruitChannel || !recruitChannel.isTextBased()) return;

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${key}`).setLabel("参加").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_${key}`).setLabel("退出").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`end_${key}`).setLabel("募集終了").setStyle(ButtonStyle.Secondary)
        );

        const msg = await recruitChannel.send({
          content:`⚔ ${mode.toUpperCase()} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})

まだ誰もいません`,
          components:[row]
        });

        recruitMessages[key] = msg;

        return interaction.update({
          content:"✅ 募集開始",
          components:[]
        });
      }

      // ===== 参加 / 退出 =====
      if(action === "join" || action === "leave"){
        const key = `${mode}_${id}`;
        if(!queues[key]) return;

        const players = queues[key];

        if(action==="join") players.add(interaction.user.id);
        if(action==="leave") players.delete(interaction.user.id);

        const list = players.size
          ? [...players].map(id=>`<@${id}>`).join("\n")
          : "まだ誰もいません";

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${key}`).setLabel("参加").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_${key}`).setLabel("退出").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`end_${key}`).setLabel("募集終了").setStyle(ButtonStyle.Secondary)
        );

        await recruitMessages[key].edit({
          content:`⚔ ${mode.toUpperCase()} PvP募集
主催者: <@${hosts[key]}>
Q (${players.size}/${MAX_PLAYERS})

${list}`,
          components:[row]
        });

        return interaction.reply({ content:"更新", ephemeral:true });
      }

      // ===== 募集終了 =====
      if(action === "end"){
        const key = `${mode}_${id}`;
        if(!queues[key]) return;

        if(interaction.user.id !== hosts[key]){
          return interaction.reply({ content:"主催者のみ終了可", ephemeral:true });
        }

        const players = queues[key];

        const list = players.size
          ? [...players].map(id=>`<@${id}>`).join("\n")
          : "誰もいません";

        await recruitMessages[key].edit({
          content:`🛑 ${mode.toUpperCase()} 募集終了
主催者: <@${hosts[key]}>
参加者 (${players.size})

${list}`,
          components:[]
        });

        delete queues[key];
        delete hosts[key];
        delete recruitMessages[key];

        return interaction.reply({ content:"終了しました", ephemeral:true });
      }
    }

  }catch(err){
    console.error(err);
  }
});

client.login(TOKEN);