import 'dotenv/config'
import fetch from 'node-fetch';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data/raw')

let response

response = await fetch('https://xkcd.com/info.0.json');
const latestComicId = (await response.json())['num'];
const comicIds = [...Array(latestComicId + 1).keys()].slice(1);

for await (const comicId of comicIds) {
  const filePath = `${DATA_DIR}/${comicId}.html`
  if(fs.existsSync(filePath)) {
    console.log(`Comic ${comicId} already exists. Skipping.`)
  } else {
    console.log(`Fetching Comic ${comicId}.`)
    response = await fetch(`https://www.explainxkcd.com/wiki/index.php/${comicId}`);
    // 🙏 https://stackoverflow.com/a/51302466/123545
    const fileStream = fs.createWriteStream(filePath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
  }
}
