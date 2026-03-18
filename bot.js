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

/* ===== 環境変数 ===== */
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;

/* ===== チャンネル ===== */
const PANEL_CHANNEL_ID = "1482967574760259727";
const RECRUIT_CHANNEL_ID = "1482990303475531796";
const TOP_CHANNEL_ID = "1483431155792347186";

/* ===== PvPモード ===== */
const MODES = ["uhcpvp","smppvp","swordpvp","vanillapvp","axepvp","potpvp","nethpvp","macepvp"];

/* ===== Tier ===== */
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];
const RANK_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];

const MAX_PLAYERS = 5;

/* ===== 状態 ===== */
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
/* 🏆 ランキング */
/* ===================== */
async function updateTopAll(guild){
  await guild.members.fetch();

  const embed = new EmbedBuilder()
    .setTitle("PvPランキング")
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

      if(best) players.push({ id: member.id, rank: best });
    }

    players.sort((a,b)=> RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

    let value = players.length
      ? players.slice(0,5).map((p,i)=>`${i+1}. 【${p.rank}】 <@${p.id}>`).join("\n")
      : "Tier未設定";

    embed.addFields({ name:`${mode.toUpperCase()}`, value });
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

  const guild = client.guilds.cache.get(GUILD_ID);
  if(guild){
    await updateTopAll(guild);
    setInterval(()=> updateTopAll(guild), 300000);
  }

  /* ===== パネル作成 ===== */
  const ch = await client.channels.fetch(PANEL_CHANNEL_ID);
  if(!ch || !ch.isTextBased()) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("create_pvp")
      .setLabel("募集作成")
      .setStyle(ButtonStyle.Primary)
  );

  await ch.send({
    content:"PvP募集パネル\nボタンから募集できます",
    components:[row]
  });
});

/* ===================== */
/* Interaction */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* ===== /init-top ===== */
    if(interaction.isChatInputCommand()){
      if(interaction.commandName==="init-top"){
        await updateTopAll(interaction.guild);
        return interaction.reply({ content:"更新完了", flags:64 });
      }
    }

    /* ===== パネル押した ===== */
    if(interaction.isButton() && interaction.customId==="create_pvp"){
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_mode_${Date.now()}`)
        .setPlaceholder("モード選択")
        .addOptions(MODES.map(m=>({
          label: m.toUpperCase(),
          value: m
        })));

      return interaction.reply({
        content:"モード選択",
        components:[new ActionRowBuilder().addComponents(menu)],
        flags:64
      });
    }

    /* ===== モード選択 ===== */
    if(interaction.isStringSelectMenu()){
      if(interaction.customId.startsWith("select_mode_")){
        const mode = interaction.values[0];
        const key = `${mode}_${Date.now()}`;

        queues[key] = new Set();
        hosts[key] = interaction.user.id;

        const ch = await client.channels.fetch(RECRUIT_CHANNEL_ID);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${key}`).setLabel("参加").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_${key}`).setLabel("退出").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`end_${key}`).setLabel("募集終了").setStyle(ButtonStyle.Secondary)
        );

        const msg = await ch.send({
          content:`${mode.toUpperCase()} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})
まだ誰もいません`,
          components:[row]
        });

        recruitMessages[key] = msg;

        return interaction.update({
          content:"募集作成完了",
          components:[]
        });
      }
    }

    /* ===== 募集ボタン ===== */
    if(interaction.isButton()){
      const args = interaction.customId.split("_");
      const action = args[0];
      const key = args.slice(1).join("_");

      if(!queues[key]) return;

      const players = queues[key];

      if(action==="join"){
        if(players.has(interaction.user.id)){
          return interaction.reply({ content:"既に参加済み", flags:64 });
        }

        if(players.size >= MAX_PLAYERS){
          return interaction.reply({ content:"満員", flags:64 });
        }

        players.add(interaction.user.id);
      }

      if(action==="leave"){
        players.delete(interaction.user.id);
      }

      if(action==="end"){
        if(interaction.user.id !== hosts[key]){
          return interaction.reply({ content:"主催者のみ終了可", flags:64 });
        }

        const list = players.size
          ? [...players].map(id=>`<@${id}>`).join("\n")
          : "誰もいません";

        await recruitMessages[key].edit({
          content:`募集終了
主催者: <@${hosts[key]}>
参加者 (${players.size})
${list}`,
          components:[]
        });

        delete queues[key];
        delete hosts[key];
        delete recruitMessages[key];

        return interaction.reply({ content:"終了", flags:64 });
      }

      const list = players.size
        ? [...players].map(id=>`<@${id}>`).join("\n")
        : "まだ誰もいません";

      await recruitMessages[key].edit({
        content:`PvP募集
主催者: <@${hosts[key]}>
Q (${players.size}/${MAX_PLAYERS})
${list}`
      });

      return interaction.reply({ content:"更新", flags:64 });
    }

  }catch(err){
    console.error(err);
  }
});

client.login(TOKEN);