require("dotenv").config();
const fs = require("fs");
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
const GUILD_ID = process.env.GUILD_ID;

/* ===== チャンネル ===== */
const PANEL_CHANNEL_ID = "1483800313860198450";
const RESULT_CHANNEL_ID = "1483020005183324250";
const TOP_CHANNEL_ID = "1483431155792347186";
const RECRUIT_CHANNEL_ID = "1482990303475531796";

/* ===== Tier ===== */
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];
const RANK_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];

/* ===== PvP ===== */
const MAX_PLAYERS = 5;
let queues = {};
let hosts = {};
let recruitMessages = {};
let recruitModes = {};

/* ===== データ保存 ===== */
let data = {};
if(fs.existsSync("data.json")){
  data = JSON.parse(fs.readFileSync("data.json"));
}
function save(){
  fs.writeFileSync("data.json", JSON.stringify(data,null,2));
}

const client = new Client({
  intents:[
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

let userPages = new Map();

/* ===================== */
/* チャンネル削除 */
/* ===================== */
async function clearChannel(id){
  const ch = await client.channels.fetch(id);
  if(!ch?.isTextBased()) return;

  let lastId;
  while(true){
    const msgs = await ch.messages.fetch({limit:100, before:lastId});
    if(!msgs.size) break;
    await ch.bulkDelete(msgs, true).catch(()=>{});
    lastId = msgs.last().id;
  }
}

/* ===================== */
/* ランキング */
/* ===================== */
function buildRankingEmbed(){
  const embed = new EmbedBuilder()
    .setTitle("🏆 PvPランキング")
    .setColor("#FFD700");

  for(const mode of TIER_MODES){
    let arr = [];
    for(const id in data){
      if(data[id][mode]){
        arr.push({id, rank:data[id][mode]});
      }
    }

    arr.sort((a,b)=>RANK_ORDER.indexOf(a.rank)-RANK_ORDER.indexOf(b.rank));

    const text = arr.length
      ? arr.slice(0,5).map((p,i)=>`${i+1}. 【${p.rank}】 <@${p.id}>`).join("\n")
      : "なし";

    embed.addFields({name:mode.toUpperCase(), value:text});
  }

  return embed;
}

async function updateRanking(){
  const ch = await client.channels.fetch(TOP_CHANNEL_ID);
  if(!ch?.isTextBased()) return;

  await clearChannel(TOP_CHANNEL_ID);
  await ch.send({embeds:[buildRankingEmbed()]});
}

/* ===================== */
/* 起動 */
/* ===================== */
client.once(Events.ClientReady, async ()=>{
  console.log("起動");

  const guild = client.guilds.cache.get(GUILD_ID);
  await guild.members.fetch();

  await clearChannel(PANEL_CHANNEL_ID);
  await clearChannel(RESULT_CHANNEL_ID);
  await clearChannel(TOP_CHANNEL_ID);

  await updateRanking();

  const ch = await client.channels.fetch(PANEL_CHANNEL_ID);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("open_tier")
      .setLabel("🎯 Tier設定")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("create_pvp")
      .setLabel("⚔ 募集作成")
      .setStyle(ButtonStyle.Success)
  );

  await ch.send({
    content:"🎯 管理パネル",
    components:[row]
  });
});

/* ===================== */
/* Interaction */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* ===== Tier開始 ===== */
    if(interaction.isButton() && interaction.customId==="open_tier"){

      const members = [...interaction.guild.members.cache.values()]
        .filter(m=>!m.user.bot);

      const pages = [];
      for(let i=0;i<members.length;i+=25){
        pages.push(
          members.slice(i,i+25).map(m=>({
            label:m.user.username,
            value:m.id
          }))
        );
      }

      userPages.set(interaction.user.id,{
        pages,
        index:0
      });

      return sendUserPage(interaction, interaction.user.id);
    }

    /* ===== ページ移動 ===== */
    if(interaction.isButton() && interaction.customId.startsWith("page_")){
      const d = userPages.get(interaction.user.id);
      if(!d) return;

      if(interaction.customId==="page_next") d.index++;
      if(interaction.customId==="page_prev") d.index--;

      return sendUserPage(interaction, interaction.user.id, true);
    }

    /* ===== ユーザー選択 ===== */
    if(interaction.isStringSelectMenu() && interaction.customId==="select_user"){
      const userId = interaction.values[0];

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_mode_${userId}`)
        .addOptions(TIER_MODES.map(m=>({label:m,value:m})));

      return interaction.update({
        content:"モード選択",
        components:[new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ===== モード選択 ===== */
    if(interaction.isStringSelectMenu() && interaction.customId.startsWith("select_mode_")){
      const userId = interaction.customId.split("_")[2];
      const mode = interaction.values[0];

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`final_rank_${userId}_${mode}`)
        .addOptions(RANK_ORDER.map(r=>({label:r,value:r})));

      return interaction.update({
        content:`ランク選択 (${mode})`,
        components:[new ActionRowBuilder().addComponents(menu)]
      });
    }

    /* ===== ランク決定 ===== */
    if(interaction.isStringSelectMenu() && interaction.customId.startsWith("final_rank_")){
      const [_,__,userId,mode] = interaction.customId.split("_");
      const rank = interaction.values[0];

      if(!data[userId]) data[userId] = {};
      data[userId][mode] = rank;
      save();

      const resultCh = await client.channels.fetch(RESULT_CHANNEL_ID);

      await resultCh.send({
        content:`🏆 Tier結果
プレイヤー: <@${userId}>
モード: ${mode}
ランク: ${rank}
テスター: <@${interaction.user.id}>`
      });

      await updateRanking();

      return interaction.update({
        content:"完了",
        components:[]
      });
    }

    /* ===== PvP作成 ===== */
    if(interaction.isButton() && interaction.customId==="create_pvp"){
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`pvp_mode_${Date.now()}`)
        .addOptions(TIER_MODES.map(m=>({label:m,value:m})));

      return interaction.reply({
        content:"モード選択",
        components:[new ActionRowBuilder().addComponents(menu)],
        flags:64
      });
    }

    /* ===== PvPモード選択 ===== */
    if(interaction.isStringSelectMenu() && interaction.customId.startsWith("pvp_mode_")){
      const mode = interaction.values[0];
      const key = `${mode}_${Date.now()}`;

      queues[key] = new Set();
      hosts[key] = interaction.user.id;
      recruitModes[key] = mode;

      const ch = await client.channels.fetch(RECRUIT_CHANNEL_ID);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`join_${key}`).setLabel("参加").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`leave_${key}`).setLabel("退出").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(`end_${key}`).setLabel("終了").setStyle(ButtonStyle.Secondary)
      );

      const msg = await ch.send({
        content:`⚔ ${mode} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})`,
        components:[row]
      });

      recruitMessages[key] = msg;

      return interaction.update({content:"作成完了", components:[]});
    }

    /* ===== PvP操作 ===== */
    if(interaction.isButton()){
      const args = interaction.customId.split("_");
      const action = args[0];
      const key = args.slice(1).join("_");

      if(!queues[key]) return;

      const players = queues[key];

      if(action==="join"){
        if(players.size >= MAX_PLAYERS){
          return interaction.reply({content:"満員", flags:64});
        }
        players.add(interaction.user.id);
      }

      if(action==="leave"){
        players.delete(interaction.user.id);
      }

      if(action==="end"){
        if(interaction.user.id !== hosts[key]){
          return interaction.reply({content:"主催者のみ", flags:64});
        }

        await recruitMessages[key].edit({
          content:"🛑 募集終了",
          components:[]
        });

        delete queues[key];
        return interaction.reply({content:"終了", flags:64});
      }

      const list = [...players].map(id=>`<@${id}>`).join("\n") || "なし";

      await recruitMessages[key].edit({
        content:`⚔ ${recruitModes[key]} PvP募集
主催者: <@${hosts[key]}>
Q (${players.size}/${MAX_PLAYERS})
${list}`
      });

      return interaction.reply({content:"更新", flags:64});
    }

  }catch(e){
    console.error(e);
  }
});

/* ===================== */
/* ページ表示 */
/* ===================== */
function sendUserPage(interaction, userId, update=false){
  const d = userPages.get(userId);
  const page = d.pages[d.index];

  const menu = new StringSelectMenuBuilder()
    .setCustomId("select_user")
    .setPlaceholder(`ユーザー選択 (${d.index+1}/${d.pages.length})`)
    .addOptions(page);

  const nav = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("page_prev")
      .setLabel("◀")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(d.index===0),
    new ButtonBuilder()
      .setCustomId("page_next")
      .setLabel("▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(d.index===d.pages.length-1)
  );

  if(update){
    return interaction.update({
      content:"ユーザー選択",
      components:[new ActionRowBuilder().addComponents(menu), nav]
    });
  }else{
    return interaction.reply({
      content:"ユーザー選択",
      components:[new ActionRowBuilder().addComponents(menu), nav],
      flags:64
    });
  }
}

client.login(TOKEN);

/* keep alive */
require("http")
  .createServer((req,res)=>res.end("ok"))
  .listen(process.env.PORT || 3000);
