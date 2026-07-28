const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { DisTube } = require('distube');
const { SoundCloudPlugin } = require('@distube/soundcloud');
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

// SES MOTORU UYUMLULUK VE BUFFER MODLARI AKTİF EDİLDİ
const distube = new DisTube(client, {
    emitNewSongOnly: true,
    leaveOnFinish: false,
    plugins: [
        new SoundCloudPlugin({
            clientId: 'KKzJxmw11tYpCs6T24P4uUYhqmjalG6M'
        })
    ]
});

client.once('ready', () => {
    console.log(`🤖 Kross Müzik Bot² sorunsuz başlatıldı! Ses kanalları dinleniyor.`);
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

        await message.reply('🔍 Müzik yükleniyor, lütfen bekleyin...');

        try {
            await distube.play(voiceChannel, searchKeyword, {
                textChannel: message.channel,
                member: message.member,
                message
            });
        } catch (error) {
            console.error(error);
            message.channel.send('❌ Şarkı oynatılamadı. Lütfen SoundCloud üzerinde olan bir şarkı ismi deneyin.');
        }
    }
});

distube.on('playSong', (queue, song) => {
    const embed = new EmbedBuilder()
        .setColor('#16a085')
        .setTitle('🎵 Kross Müzik Bot² | Şu Anda Oynatılıyor')
        .setDescription(`**[${song.name}](${song.url})**`)
        .addFields(
            { name: '🕒 Süre', value: song.formattedDuration, inline: true },
            { name: '👤 İsteyen', value: `${song.user}`, inline: true }
        )
        .setThumbnail(song.thumbnail)
        .setFooter({ text: 'Kross Müzik Bot² • Keyifli Dinlemeler Diler!' })
        .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pause_resume').setLabel('⏸️ Duraklat/Devam').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('skip_song').setLabel('⏭️ Şarkıyı Geç').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('stop_bot').setLabel('⏹️ Durdur & Çık').setStyle(ButtonStyle.Danger)
    );

    queue.textChannel.send({ embeds: [embed], components: [row] });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    const queue = distube.getQueue(interaction.guildId);

    if (!queue) return interaction.reply({ content: '❌ Aktif çalan bir müzik bulunamadı.', ephemeral: true });

    if (interaction.customId === 'pause_resume') {
        if (queue.paused) { queue.resume(); await interaction.reply({ content: '▶️ Devam ediyor.', ephemeral: true }); }
        else { queue.pause(); await interaction.reply({ content: '⏸️ Duraklatıldı.', ephemeral: true }); }
    }
    if (interaction.customId === 'skip_song') {
        try { await queue.skip(); await interaction.reply({ content: '⏭️ Geçildi.', ephemeral: true }); }
        catch { queue.stop(); await interaction.reply({ content: '⏹️ Sıra bitti.', ephemeral: true }); }
    }
    if (interaction.customId === 'stop_bot') {
        queue.stop();
        await interaction.reply({ content: '⏹️ Kross kanaldan ayrıldı.', ephemeral: false });
    }
});

client.login(process.env.DISCORD_TOKEN);
