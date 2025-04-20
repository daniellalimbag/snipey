const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const credentials = require('./config/credentials.json');

class DiscordNotifier {
  constructor(channelId) {
    this.token = credentials.discord_token;
    this.channelId = channelId;
    this.client = new Client({ 
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
      ]
    });
    
    // track which notifications have been sent to avoid duplicates
    this.sentNotifications = new Map();
    this.lastNotificationTime = new Map();
  }
  
  async initialize() {
    try {
      await this.client.login(this.token);
      console.log('Discord bot logged in successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize Discord bot:', error);
      return false;
    }
  }
  
  shutdown() {
    if (this.client) {
      this.client.destroy();
      console.log('Discord bot shut down');
    }
  }
  
  async sendNotification(title, content, courseData = null) {
    try {
      // Skip "Found available class" and "Found available classes! See summary below:" messages
      if (content.includes("Found available class") || content.includes("Found available classes! See summary below:")) {
        console.log("Skipping redundant notification:", content);
        return;
      }
      
      let notificationKey;
      
      if (courseData && courseData.courseCode && courseData.classCode) {
        notificationKey = `${courseData.courseCode}-${courseData.classCode}`;
      } else {
        const match = content.match(/([A-Z]+)-(\d+)/);
        if (match && match.length >= 3) {
          notificationKey = `${match[1]}-${match[2]}`;
          if (!courseData) {
            courseData = {
              courseCode: match[1],
              classCode: match[2]
            };
          }
        } else {
          notificationKey = content.substring(0, 50);
        }
      }
      
      const now = Date.now();
      const lastSent = this.lastNotificationTime.get(notificationKey) || 0;
      const timeSinceLastNotification = now - lastSent;
      
      // only send if we haven't sent this notification in the last 2 minutes
      // this prevents spam but allows re-notification after some time
      if (timeSinceLastNotification < 120000) { // 2 minutes in milliseconds
        console.log(`Skipping notification for ${notificationKey} - sent ${timeSinceLastNotification/1000} seconds ago`);
        return;
      }
      
      this.lastNotificationTime.set(notificationKey, now);
      
      const channel = await this.client.channels.fetch(this.channelId);
      
      if (!channel) {
        console.error(`Could not find channel with ID: ${this.channelId}`);
        return;
      }
      
      if (courseData && courseData.courseCode && courseData.classCode) {
        const embed = new EmbedBuilder()
          .setTitle(title)
          .setDescription(`${courseData.courseCode}-${courseData.classCode} is now OPEN for enrollment!`)
          .setColor('#00ff00')
          .addFields(
            { name: 'Course Code', value: courseData.courseCode },
            { name: 'Class Code', value: courseData.classCode }
          )
          .setTimestamp();
          
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(`**${title}**\n${content}`);
      }
      
      console.log('Discord notification sent successfully');
    } catch (error) {
      console.error('Failed to send Discord notification:', error);
    }
  }
}

module.exports = DiscordNotifier;