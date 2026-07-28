const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const play = require('play-dl');
const express = require('express'); // Ücretsiz Render portu için eklendi

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const queues = new Map();

// RENDER ÜCRETSİZ PORT ZORUNLULUĞU AYARI
const app = express();
app.get('/', (req, res) => res.send('🚀 Kross Müzik Bot² Aktif! Port dinleniyor.'));
app.listen(process.env.PORT || 3000, () => {
    console.log('🌐 Web sunucusu Render için hazır hale getirildi.');
});

client.once('ready', () => {
    console.log(`🤖 Kross Müzik Bot² aktif edildi! Müzik sistemleri hazır.`);
    client.user.setActivity('🎧 !play | Kross Müzik Bot²', { type: 2 }); 
});

async function playSong(guildId, song) {
    const serverQueue = queues.get(guildId);
    if (!song) {
        setTimeout(() => {
            const currentQueue = queues.get(guildId);
            if (currentQueue && currentQueue.songs.length === 0) {
                currentQueue.connection.destroy();
                queues.delete(guildId);
            }
        }, 120000);
        return;
    }

    try {
        const stream = await play.stream(song.url);
        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        
        serverQueue.player.play(resource);
        serverQueue.connection.subscribe(serverQueue.player);

        const embed = new EmbedBuilder()
            .setColor('#16a085')
            .setTitle('🎵 Kross Müzik Bot² | Şu Anda Oynatılıyor')
            .setDescription(`**[${song.title}](${song.url})**`)
            .addFields(
                { name: '🕒 Süre', value: song.duration, inline: true },
                { name: '👤 İsteyen', value: `<@${song.requestedBy}>`, inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setFooter({ text: 'Kross Müzik Bot² • Keyifli Dinlemeler Diler!' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️ Duraklat/Devam').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('skip_song').setLabel('⏭️ Şarkıyı Geç').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('show_queue').setLabel('📜 Sırayı Gör').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('stop_bot').setLabel('⏹️ Durdur & Çık').setStyle(ButtonStyle.Danger)
        );

        serverQueue.textChannel.send({ embeds: [embed], components: [row] });
    } catch (error) {
        console.error(error);
        serverQueue.textChannel.send('❌ Şarkı oynatılırken teknik bir hata oluştu.');
        serverQueue.songs.shift();
        playSong(guildId, serverQueue.songs);
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'oynat' || command === 'play') {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) return message.reply('❌ Önce bir ses kanalına girmelisin!');

        const searchKeyword = args.join(' ');
        if (!searchKeyword) return message.reply('❌ Lütfen bir şarkı adı veya YouTube linki girin.');

        let serverQueue = queues.get(message.guild.id);

        try {
            let yt_info = await play.search(searchKeyword, { limit: 1 });
            if (yt_info.length === 0) return message.reply('❌ Şarkı bulunamadı.');

            const song = {
                title: yt_info[0].title,
                url: yt_info[0].url,
                duration: yt_info[0].durationRaw || 'Bilinmiyor',
                thumbnail: yt_info[0].thumbnails?.[0]?.url || '',
                requestedBy: message.author.id
            };

            if (!serverQueue) {
                const queueConstruct = {
                    textChannel: message.channel,
                    voiceChannel: voiceChannel,
                    connection: null,
                    player: createAudioPlayer(),
                    songs: []
                };

                queues.set(message.guild.id, queueConstruct);
                queueConstruct.songs.push(song);

                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.connection = connection;

                queueConstruct.player.on(AudioPlayerStatus.Idle, () => {
                    queueConstruct.songs.shift();
                    playSong(message.guild.id, queueConstruct.songs);
                });

                playSong(message.guild.id, queueConstruct.songs);
            } else {
                serverQueue.songs.push(song);
                return message.reply(`✅ **${song.title}** başarıyla Kross sırasına eklendi! (Sıradaki Yeri: #${serverQueue.songs.length - 1})`);
            }

        } catch (error) {
            console.error(error);
            message.reply('❌ Şarkı eklenirken hata meydana geldi.');
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const serverQueue = queues.get(interaction.guildId);

    if (!serverQueue) {
        return interaction.reply({ content: '❌ Aktif çalan bir müzik bulunamadı.', ephemeral: true });
    }

    if (interaction.customId === 'pause_resume') {
        if (serverQueue.player.state.status === 'paused') {
            serverQueue.player.unpause();
            await interaction.reply({ content: '▶️ Müzik devam ettiriliyor.', ephemeral: true });
        } else {
            serverQueue.player.pause();
            await interaction.reply({ content: '⏸️ Müzik duraklatıldı.', ephemeral: true });
        }
    }

    if (interaction.customId === 'skip_song') {
        serverQueue.player.stop();
        await interaction.reply({ content: '⏭️ Şarkı başarıyla geçildi.', ephemeral: true });
    }

    if (interaction.customId === 'show_queue') {
        if (serverQueue.songs.length <= 1) {
            return interaction.reply({ content: '🎵 Sırada başka şarkı yok.', ephemeral: true });
        }
        let queueString = serverQueue.songs.slice(1, 6).map((song, index) => `**${index + 1}.** ${song.title}`).join('\n');
        if (serverQueue.songs.length > 6) queueString += `\n*ve daha ${serverQueue.songs.length - 6} şarkı...*`;

        await interaction.reply({ content: `📋 **Kross Müzik Bot² Şarkı Sırası:**\n${queueString}`, ephemeral: true });
    }

    if (interaction.customId === 'stop_bot') {
        serverQueue.songs = [];
        serverQueue.player.stop();
        if (serverQueue.connection) serverQueue.connection.destroy();
        queues.delete(interaction.guildId);
        await interaction.reply({ content: '⏹️ Müzik kapatıldı ve Kross kanaldan ayrıldı.', ephemeral: false });
    }
});

client.login(process.env.DISCORD_TOKEN);
