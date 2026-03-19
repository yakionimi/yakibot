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
const PANEL_CHANNEL_ID = "1484035194867417098";
const RECRUIT_CHANNEL_ID = "1482990303475531796";
const RESULT_CHANNEL_ID = "1483020005183324250";
const TOP_CHANNEL_ID = "1483431155792347186";

/* ===== PvP募集ロール ===== */
const ROLE_MAP = {
  uhcpvp: "1482930677556183174",
  smppvp: "1482930678852223186",
  swordpvp: "1482930680152195175",
  vanillapvp: "1482930681247174718",
  axepvp: "1482930682471780504",
  potpvp: "1482930683805696094",
  nethpvp: "1482930685345009684",
  macepvp: "1482930686846308513"
};

/* ===== Tier ===== */
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];
const RANK_ORDER = [
  "HT1","LT1",
  "HT2","LT2",
  "HT3","LT3",
  "HT4","LT4",
  "HT5","LT5"
];

const MAX_PLAYERS = 5;

/* ===== 状態 ===== */
let queues = {};
let hosts = {};
let recruitMessages = {};
let recruitModes = {};
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

      if(best) players.push({ id: member.id, rank: best });
    }

    players.sort((a,b)=> RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank));

    const value = players.length
      ? players.slice(0,5).map((p,i)=>`${i+1}. 【${p.rank}】 <@${p.id}>`).join("\n")
      : "なし";

    embed.addFields({ name:`⚔ ${mode.toUpperCase()}`, value });
  }

  const ch = await client.channels.fetch(TOP_CHANNEL_ID);
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
  }

  /* ===== 募集パネル ===== */
  const ch = await client.channels.fetch(PANEL_CHANNEL_ID);
  if(!ch || !ch.isTextBased()) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("create_pvp")
      .setLabel("募集作成")
      .setStyle(ButtonStyle.Primary)
  );

  await ch.send({
    content:"🔥 PvP募集パネル\nボタンから募集できます",
    components:[row]
  });
});

/* ===================== */
/* Interaction */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* ===== /tier ===== */
    if(interaction.isChatInputCommand()){
      if(interaction.commandName==="tier"){

        const player = interaction.options.getUser("player");

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`tier_mode_${player.id}_${interaction.user.id}`)
          .setPlaceholder("モード選択")
          .addOptions(TIER_MODES.map(m=>({
            label:m,
            value:m
          })));

        return interaction.reply({
          content:"モード選択",
          components:[new ActionRowBuilder().addComponents(menu)],
          flags:64
        });
      }

      if(interaction.commandName==="init-top"){
        await updateTopAll(interaction.guild);
        return interaction.reply({ content:"更新完了", flags:64 });
      }
    }

    /* ===== Tier選択 ===== */
    if(interaction.isStringSelectMenu()){

      if(interaction.customId.startsWith("tier_mode_")){
        const [_,__,playerId,executorId] = interaction.customId.split("_");

        const mode = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`tier_rank_${playerId}_${mode}_${executorId}`)
          .addOptions(RANK_ORDER.map(r=>({ label:r, value:r })));

        return interaction.update({
          content:`ランク選択 (${mode})`,
          components:[new ActionRowBuilder().addComponents(menu)]
        });
      }

      if(interaction.customId.startsWith("tier_rank_")){
        const [_,__,playerId,mode,executorId] = interaction.customId.split("_");
        const rank = interaction.values[0];

        const member = await interaction.guild.members.fetch(playerId);

        /* ===== 既存削除 ===== */
        for(const r of member.roles.cache.values()){
          if(r.name.startsWith(mode+"-")){
            await member.roles.remove(r);
          }
        }

        /* ===== 付与 ===== */
        const role = interaction.guild.roles.cache.find(r=>r.name===`${mode}-${rank}`);
        if(role) await member.roles.add(role);

        /* ===== 結果 ===== */
        const resultCh = await client.channels.fetch(RESULT_CHANNEL_ID);

        if(resultCh?.isTextBased()){
          await resultCh.send({
            content:`🏆 Tier結果
プレイヤー: <@${playerId}>
モード: ${mode}
ランク: ${rank}
テスター: <@${executorId}>`
          });
        }

        await updateTopAll(interaction.guild);

        return interaction.update({
          content:"付与完了",
          components:[]
        });
      }
    }

    /* ===================== */
    /* PvP募集 */
    /* ===================== */

    if(interaction.isButton() && interaction.customId==="create_pvp"){
      const menu = new StringSelectMenuBuilder()
        .setCustomId(`select_mode_${Date.now()}`)
        .setPlaceholder("モード選択")
        .addOptions(Object.keys(ROLE_MAP).map(m=>({
          label:m.toUpperCase(),
          value:m
        })));

      return interaction.reply({
        content:"モード選択",
        components:[new ActionRowBuilder().addComponents(menu)],
        flags:64
      });
    }

    if(interaction.isStringSelectMenu()){
      if(interaction.customId.startsWith("select_mode_")){

        const mode = interaction.values[0];
        const key = `${mode}_${Date.now()}`;

        queues[key] = new Set();
        hosts[key] = interaction.user.id;
        recruitModes[key] = mode;

        const roleName = ROLE_MAP[mode];
        const role = interaction.guild.roles.cache.find(r=>r.name === roleName);
        const mention = role ? `<@&${role.id}>` : "";

        const ch = await client.channels.fetch(RECRUIT_CHANNEL_ID);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`join_${key}`).setLabel("参加").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`leave_${key}`).setLabel("退出").setStyle(ButtonStyle.Danger),
          new ButtonBuilder().setCustomId(`end_${key}`).setLabel("終了").setStyle(ButtonStyle.Secondary)
        );

        const msg = await ch.send({
          content:`${mention}
⚔ ${mode.toUpperCase()} PvP募集
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

    if(interaction.isButton()){
      const args = interaction.customId.split("_");
      const action = args[0];
      const key = args.slice(1).join("_");

      if(!queues[key]) return;

      const players = queues[key];
      const mode = recruitModes[key];

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

        await recruitMessages[key].edit({
          content:`🛑 募集終了`,
          components: recruitMessages[key].components
        });

        delete queues[key];
        delete hosts[key];
        delete recruitMessages[key];
        delete recruitModes[key];

        return interaction.reply({ content:"終了", flags:64 });
      }

      const list = players.size
        ? [...players].map(id=>`<@${id}>`).join("\n")
        : "まだ誰もいません";

      await recruitMessages[key].edit({
        content:`⚔ ${mode.toUpperCase()} PvP募集
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