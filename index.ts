import { google } from "googleapis";
import { Context, Telegraf } from "telegraf";

const youtube = google.youtube("v3");
import * as cron from "node-cron";

const playlists = [
  "PLnBhm4gyqDGAV-BESRro-tQ5JDhWuV8SE",
  "PLnBhm4gyqDGD9CmfYrs4NZWZcQK-ufle7",
];

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
  // const randomIdFromFirstPlaylist = (await new Promise((resolve, reject) => {

  //     }
  //   );
  // })) as string;
  // const randomIdFromSecondPlaylist = (await new Promise((resolve, reject) => {
  //
  // })) as string;

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

const startCron = (ctx: Context) => {
  const task = cron.schedule("0 12 * * *", async () => {
    const links = await getRandomVideos();
    links.forEach((link, idx) => {
      console.log(
        `${link.link.split("v=")[1]}-${link.playlistId}-${
          ctx.message.message_id
        }-${idx + 1}`
      );
      ctx.reply(`${idx + 1}#: ${link.link}`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "Другое Видео",
                callback_data: `${link.link.split("v=")[1]}_${
                  link.playlistId
                }_${ctx.message.message_id}_${idx + 1}`,
              },
            ],
          ],
        },
      });
    });
  });
  task.start();
};

const bot = new Telegraf("5532085065:AAGH1oSLNazNn02pnmG2-jWKM9C1gvqFl8M");

bot.start(async (ctx) => {
  startCron(ctx);

  ctx.reply("Привет, любимая. Надеюсь, это сработает...");
  const links = await getRandomVideos();
  links.forEach((link, idx) => {
    console.log(
      `${link.link.split("v=")[1]}-${link.playlistId}-${
        ctx.message.message_id
      }-${idx + 1}`
    );
    ctx.reply(`${idx + 1}#: ${link.link}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Другое Видео",
              callback_data: `${link.link.split("v=")[1]}_${link.playlistId}_${
                ctx.message.message_id
              }_${idx + 1}`,
            },
          ],
        ],
      },
    });
  });
});

bot.action(
  /([a-zA-Z0-9_]+)[_]([a-zA-Z0-9-]+)[_]([0-9]+)[_]([0-9]+)/,
  async (ctx) => {
    console.log("here");
    const videoId = ctx.match[1];
    const playlistId = ctx.match[2];
    const messageId = ctx.match[3];
    const videoIdx = ctx.match[4];
    console.log(playlistId, videoId);
    const videoLink = await getRandomVideoFromPlayList(playlistId, videoId);
    ctx.reply(`${+videoIdx}#: ${videoLink.link}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Другое Видео",
              callback_data: `${videoLink.link.split("v=")[1]}_${
                videoLink.playlistId
              }_${messageId}_${videoIdx}`,
            },
          ],
        ],
      },
    });
  }
);

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
bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
