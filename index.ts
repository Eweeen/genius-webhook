import { Elysia } from "elysia";
import { cron } from "@elysiajs/cron";
import axios from "axios";
import { format, getYear, isSameDay } from "date-fns";
import { fr } from "date-fns/locale";

interface Album {
  date: Date;
  artist: string;
  title: string;
}

new Elysia()
  .use(
    cron({
      name: "genius",
      pattern: "0 8 * * *", // Every day at 8:00 AM
      run() {
        fetchOutput();
      },
    })
  )
  .listen(3000);

/**
 * Récupère les sorties d'albums de rap français du jour
 * et envoie un message sur un webhook Discord
 *
 * @async
 * @returns {Promise<void>}
 */
async function fetchOutput(): Promise<void> {
  const year = getYear(new Date());
  const today = new Date("2024-05-10");

  const response = await axios.get(
    `https://genius.com/Genius-france-discographie-rap-${year}-annotated`
  );

  const regex = /[-*]\s*(\d{2}\/\d{2})\s*:\s*([^<]+)\s*-\s*<i>([^<]+)<\/i>/gm;
  const matches = response.data.match(regex);

  const albums: Album[] = [];

  for (const match of matches) {
    const [date, artist, title] = match
      .replace(regex, "$1 - $2 - $3")
      .split(" - ");

    const formattedDate = new Date(
      `${year}/${date.split("/").reverse().join("/")}`.replaceAll("/", "-")
    );

    if (!isSameDay(formattedDate, today)) continue;

    albums.push({
      date: formattedDate,
      artist: artist.trim(),
      title: title.trim(),
    } as Album);
  }

  if (!albums.length) return;

  const day = format(today, "EEEE dd MMMM", { locale: fr });
  const content = albums.map((album) => `- ${album.artist} - ${album.title}\n`);

  sendWebhook(`Sorties du ${day} :\n${content.join("")}`);
}

/**
 * Envoie un message sur un webhook Discord
 *
 * @async
 * @param {string} content - Contenu du message
 * @returns {Promise<void>}
 */
async function sendWebhook(content: string): Promise<void> {
  const id = process.env.WEBHOOK_ID;
  const token = process.env.WEBHOOK_TOKEN;
  const url = `https://discord.com/api/webhooks/${id}/${token}`;

  const data = { content, username: "Genius" };
  await axios.post(url, data);
}
