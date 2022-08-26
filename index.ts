import { google } from "googleapis";
import Redis from "ioredis";
import { ScheduledTask } from "node-cron";
import { Telegraf } from "telegraf";
import * as cron from "node-cron";
import * as dotenv from "dotenv";

dotenv.config();

const youtube = google.youtube("v3");

const redis = new Redis({
  host: "redis-16144.c89.us-east-1-3.ec2.cloud.redislabs.com",
  port: 16144,
  password: process.env.REDIS_PW,
});

const tasks: { chatId: string; task: ScheduledTask }[] = [];

const playlists = [
  "PLnBhm4gyqDGAV-BESRro-tQ5JDhWuV8SE",
  "PLnBhm4gyqDGD9CmfYrs4NZWZcQK-ufle7",
];

const startCron = (chatId: string) => {
  const task = cron.schedule("0 7 * * *", async () => {
    const links = await getRandomVideos();
    links.forEach((link, idx) => {
      console.log(`${link.link.split("v=")[1]}-${link.playlistId}-${idx + 1}`);
      bot.telegram.sendMessage(chatId, `${idx + 1}#: ${link.link}`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Другое Видео",
                callback_data: `${link.link.split("v=")[1]}_${
                  link.playlistId
                }_${idx + 1}`,
              },
            ],
          ],
        },
      });
    });
  });
  task.start();
  return task;
};

const getRandomVideoFromPlayList = async (
  playlistId: string,
  excludeId: string
): Promise<{ link: string; playlistId: string }> => {
  return await new Promise((resolve, reject) => {
    youtube.playlistItems.list(
      {
        key: "AIzaSyCwPEhedAXEdHue800-eCPL6XCEen60krU",
        part: ["id", "snippet"],
        playlistId: playlistId,
      },
      (err, results) => {
        if (err) {
          reject(err.message);
        }

        const ids = results.data.items
          .filter((it) => it.snippet.resourceId.videoId !== excludeId)
          .map((it) => it.snippet.resourceId.videoId);

        resolve({
          link: `https://www.youtube.com/watch?v=${
            ids[Math.floor(Math.random() * ids.length)]
          }`,
          playlistId: playlistId,
        } as { link: string; playlistId: string });
      }
    );
  });
};

const getRandomVideos = async () => {
  const ids = (await Promise.all(
    playlists.map(async (pl) => {
      return await new Promise((resolve, reject) => {
        youtube.playlistItems.list(
          {
            key: "AIzaSyCwPEhedAXEdHue800-eCPL6XCEen60krU",
            part: ["id", "snippet"],
            playlistId: pl,
          },
          (err, results) => {
            if (err) {
              reject(err.message);
            }

            const ids = results.data.items.map(
              (it) => it.snippet.resourceId.videoId
            );

            resolve({
              link: ids[Math.floor(Math.random() * ids.length)],
              playlistId: pl,
            } as { link: string; playlistId: string });
          }
        );
      });
    })
  )) as { link: string; playlistId: string }[];
  return ids.map((id) => ({
    ...id,
    link: `https://www.youtube.com/watch?v=${id.link}`,
  }));
};

const bot = new Telegraf("5532085065:AAGH1oSLNazNn02pnmG2-jWKM9C1gvqFl8M");

bot.start(async (ctx) => {
  // await fetch("http://localhost:3000/schedule-job", {
  //   method: "POST",
  //   headers: {
  //     "Content-Type": "application/json",
  //   },
  //   body: JSON.stringify(ctx),
  // });
  const cacheResponse = await redis.get(ctx.chat.id.toString());
  if (!cacheResponse) {
    await redis.set(ctx.chat.id.toString(), 1);
    tasks.push({
      chatId: ctx.chat.id.toString(),
      task: startCron(ctx.chat.id.toString()),
    });
  }
  ctx.reply("Привет, любимая. Надеюсь, это сработает...");
  const links = await getRandomVideos();
  links.forEach((link, idx) => {
    console.log(
      `${link.link.split("v=")[1]}_${link.playlistId}_${
        ctx.message.message_id
      }_${idx + 1}`
    );
    ctx.reply(`${idx + 1}#: ${link.link}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Другое Видео",
              callback_data: `${link.link.split("v=")[1]}_${link.playlistId}_${
                idx + 1
              }`,
            },
          ],
        ],
      },
    });
  });
});

bot.action(/([a-zA-Z0-9_]+)[_]([a-zA-Z0-9-]+)[_]([0-9]+)/, async (ctx) => {
  console.log("here");

  const videoId = ctx.match[1];
  const playlistId = ctx.match[2];
  const videoIdx = ctx.match[3];

  console.log(ctx);

  const videoLink = await getRandomVideoFromPlayList(playlistId, videoId);
  ctx.reply(`${+videoIdx}#: ${videoLink.link}`, {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Другое Видео",
            callback_data: `${videoLink.link.split("v=")[1]}_${
              videoLink.playlistId
            }_${videoIdx}`,
          },
        ],
      ],
    },
  });
});

bot.command("refresh", async (ctx) => {
  const links = await getRandomVideos();
  links.forEach((link, idx) => {
    console.log(
      `${link.link.split("v=")[1]}-${link.playlistId}-${0}-${idx + 1}`
    );
    ctx.reply(`${idx + 1}#: ${link.link}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Другое Видео",
              callback_data: `${link.link.split("v=")[1]}_${
                link.playlistId
              }_${0}_${idx + 1}`,
            },
          ],
        ],
      },
    });
  });
});
bot.command("quit", async (ctx) => {
  // Using context shortcut
  ctx.leaveChat();
});

bot.launch().then(async () => {
  const allKeys = await redis.keys("*");
  console.log(allKeys);
  await Promise.all(
    allKeys.map(async (key) => {
      if (!tasks.find((t) => t.chatId === key)) {
        tasks.push({ chatId: key, task: startCron(key) });
      }
    })
  );
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
