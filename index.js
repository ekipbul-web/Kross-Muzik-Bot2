const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const express = require('express');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Render port sabitlemesi
const app = express();
app.get('/', (req, res) => res.send('🚀 Kross Müzik Bot² Sistemi Aktif!'));
app.listen(process.env.PORT || 3000);

let player = createAudioPlayer();
let connection;

// SoundCloud yetkilendirmesi koda dahil edildi
play.setToken({
    soundcloud: {
        client_id: 'KKzJxmw11tYpCs6T24P4uUYhqmjalG6M'
    }
});

client.once('ready', () => {
    console.log(`🤖 Kross Müzik Bot² aktif! Sistemler tamamen kararlı.`);
    client.user.setActivity('🎧 !play | Kross Müzik Bot²', { type: 2 }); 
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'oynat' || command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin!');

        const searchKeyword = args.join(' ');
        if (!searchKeyword) return message.reply('❌ Lütfen bir şarkı adı girin.');

        await message.reply('🔍 SoundCloud üzerinden müzik yükleniyor, lütfen bekleyin...');

        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        try {
            // YOUTUBE ENGELİNİ AŞMAK İÇİN Sadece SoundCloud Araması Yapmaya Zorlama (source: 'soundcloud')
            let search_info = await play.search(searchKeyword, { limit: 1, source: 'soundcloud' });
            if (search_info.length === 0) return message.reply('❌ Aradığınız şarkı SoundCloud üzerinde bulunamadı.');

            // Canlı akış uyumluluk modu aktif edildi
            let stream = await play.stream(search_info[0].url, { discordPlayerCompatibility: true });
            let resource = createAudioResource(stream.stream, { inputType: stream.type });

            player.play(resource);
            connection.subscribe(player);

            const embed = new EmbedBuilder()
                .setColor('#16a085')
                .setTitle('🎵 Kross Müzik Bot² | Şu Anda Oynatılıyor')
                .setDescription(`**[${search_info[0].name || search_info[0].title}](${search_info[0].url})**`)
                .setThumbnail(search_info[0].thumbnail || '')
                .setFooter({ text: 'Kross Müzik Bot² • Keyifli Dinlemeler Diler!' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️ Duraklat/Devam').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('stop_bot').setLabel('⏹️ Durdur & Çık').setStyle(ButtonStyle.Danger)
            );

            await message.channel.send({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error(error);
            message.channel.send('❌ Ses akışı başlatılırken bir hata oluştu veya SoundCloud kısıtlamasına takıldı.');
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'pause_resume') {
        if (player.state.status === AudioPlayerStatus.Paused) {
            player.unpause();
            await interaction.reply({ content: '▶️ Müzik devam ettiriliyor.', ephemeral: true });
        } else {
            player.pause();
            await interaction.reply({ content: '⏸️ Müzik duraklatıldı.', ephemeral: true });
        }
    }

    if (interaction.customId === 'stop_bot') {
        player.stop();
        if (connection) connection.destroy();
        await interaction.reply({ content: '⏹️ Müzik kapatıldı ve Kross kanaldan ayrıldı.', ephemeral: false });
    }
});

client.login(process.env.DISCORD_TOKEN);
