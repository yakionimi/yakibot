require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder
} = require("discord.js");

const TOKEN = process.env.TOKEN;

/* ===== 必須 ===== */
const CLIENT_ID = "1482707828547387442";
const GUILD_ID = 1478374759052873810";

/* ===== チャンネル ===== */
const PANEL_CHANNEL_ID = "1482967574760259727";
const RECRUIT_CHANNEL_ID = "1482990303475531796";
const RESULT_CHANNEL_ID = "1483020005183324250";
const TOP_CHANNEL_ID = "1483431155792347186";

/* ===== PvPモード ===== */
const MODES = ["uhcpvp","smppvp","swordpvp","vanillapvp","axepvp","potpvp","nethpvp","macepvp"];

/* ===== Tier ===== */
const TIER_MODES = ["sword","mace","uhc","smp","vanilla","axe","pot","neth"];
const RANK_ORDER = ["HT1","LT1","HT2","LT2","HT3","LT3","HT4","LT4","HT5","LT5"];
const TIER_RANKS = ["LT5","LT4","LT3","LT2","LT1","HT5","HT4","HT3","HT2","HT1"];

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
/* 🔥 スラッシュコマンド登録 */
/* ===================== */
async function registerCommands(){
  const commands = [
    new SlashCommandBuilder()
      .setName("tier")
      .setDescription("Tierを設定")
      .addUserOption(option =>
        option.setName("player")
          .setDescription("対象プレイヤー")
          .setRequired(true)
      ),

    new SlashCommandBuilder()
      .setName("init-top")
      .setDescription("ランキング更新")
  ].map(cmd => cmd.toJSON());

  const rest = new REST({ version: "10" }).setToken(TOKEN);

  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );

  console.log("✅ コマンド登録完了");
}

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

/* ===================== */
/* 起動 */
/* ===================== */
client.once(Events.ClientReady, async ()=>{
  console.log(`起動 ${client.user.tag}`);

  await registerCommands(); // ← 自動登録

  const guild = client.guilds.cache.get(GUILD_ID);
  if(guild){
    await updateTopAll(guild);
    setInterval(()=> updateTopAll(guild), 300000);
  }

  // パネル
  const ch = await client.channels.fetch(PANEL_CHANNEL_ID);
  if(!ch || !ch.isTextBased()) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("create_pvp")
      .setLabel("⚔ 募集作成")
      .setStyle(ButtonStyle.Primary)
  );

  await ch.send({
    content:"🔥 PvP募集パネル\nボタンから募集を作成できます",
    components:[row]
  });
});

/* ===================== */
/* コマンド募集 */
/* ===================== */
client.on("messageCreate", async message=>{
  if(message.author.bot) return;

  const command = message.content.toLowerCase().replace("!","");
  if(!MODES.includes(command)) return;

  const key = `${command}_${Date.now()}`;

  queues[key] = new Set();
  hosts[key] = message.author.id;

  const recruitChannel = await client.channels.fetch(RECRUIT_CHANNEL_ID);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`join_${key}`).setLabel("参加").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`leave_${key}`).setLabel("退出").setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`end_${key}`).setLabel("募集終了").setStyle(ButtonStyle.Secondary)
  );

  const msg = await recruitChannel.send({
    content:`⚔ ${command.toUpperCase()} PvP募集
主催者: <@${message.author.id}>
Q (0/${MAX_PLAYERS})
まだ誰もいません`,
    components:[row]
  });

  recruitMessages[key] = msg;
});

/* ===================== */
/* Interaction */
/* ===================== */
client.on(Events.InteractionCreate, async interaction=>{
  try{

    /* /tier */
    if(interaction.isChatInputCommand()){
      if(interaction.commandName==="init-top"){
        await updateTopAll(interaction.guild);
        return interaction.reply({ content:"更新完了", flags:64 });
      }

      if(interaction.commandName==="tier"){
        const player = interaction.options.getUser("player");

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`tier_mode_${player.id}_${interaction.user.id}`)
          .addOptions(TIER_MODES.map(m=>({ label:m, value:m })));

        return interaction.reply({
          content:`${player} のモード選択`,
          components:[new ActionRowBuilder().addComponents(menu)],
          flags:64
        });
      }
    }

    /* Tier選択 */
    if(interaction.isStringSelectMenu()){
      if(interaction.customId.startsWith("tier_mode_")){
        const [_,__,playerId,executorId] = interaction.customId.split("_");
        const mode = interaction.values[0];

        const menu = new StringSelectMenuBuilder()
          .setCustomId(`tier_rank_${playerId}_${mode}_${executorId}`)
          .addOptions(TIER_RANKS.map(r=>({ label:r, value:r })));

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

        return interaction.update({ content:"付与完了", components:[] });
      }

      /* モード選択 */
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
          content:`⚔ ${mode.toUpperCase()} PvP募集
主催者: <@${interaction.user.id}>
Q (0/${MAX_PLAYERS})
まだ誰もいません`,
          components:[row]
        });

        recruitMessages[key] = msg;

        return interaction.update({
          content:"✅ 募集作成完了",
          components:[]
        });
      }
    }

    /* パネル */
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

    /* 募集ボタン */
    if(interaction.isButton()){
      const args = interaction.customId.split("_");
      const action = args[0];
      const key = args.slice(1).join("_");

      if(!queues[key]) return;

      const players = queues[key];

      if(action==="join") players.add(interaction.user.id);
      if(action==="leave") players.delete(interaction.user.id);

      if(action==="end"){
        if(interaction.user.id !== hosts[key]){
          return interaction.reply({ content:"主催者のみ終了可", flags:64 });
        }

        const list = players.size
          ? [...players].map(id=>`<@${id}>`).join("\n")
          : "誰もいません";

        await recruitMessages[key].edit({
          content:`🛑 募集終了
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
        content:`⚔ PvP募集
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