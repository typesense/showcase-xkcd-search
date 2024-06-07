import 'dotenv/config';
import fetch from 'node-fetch';
import fs from 'fs';
import { DATA_DIR } from './utils/path.mjs';
import { exponentialBackoffRetry, BatchAPICall } from './utils/network.mjs';

let response;

response = await fetch('https://xkcd.com/info.0.json');
const latestComicId = (await response.json())['num'];
const comicIds = [...Array(latestComicId + 1).keys()].slice(1);
const batchAPICall = new BatchAPICall();

for await (const comicId of comicIds) {
  const filePath = `${DATA_DIR}/${comicId}.html`;
  if (fs.existsSync(filePath)) {
    console.log(`Explanation for comic ${comicId} already exists. Skipping.`);
  } else {
    const request = async () => {
      console.log(`Fetching explanation for comic ${comicId}.`);

      const fetchExplanation = async () => {
        const res = await fetch(
          `https://www.explainxkcd.com/wiki/index.php/${comicId}`
        );
        if (!res.ok) throw new Error('Request failed!');
        return res;
      };

      try {
        const response = await exponentialBackoffRetry(fetchExplanation, {
          callback: ({ attempt, delayMs }) =>
            console.log(
              `Retry fetching explanation for comic ${comicId}: attempt ${attempt} after ${delayMs}ms`
            ),
        });
        // 🙏 https://stackoverflow.com/a/51302466/123545
        const fileStream = fs.createWriteStream(filePath);
        await new Promise((resolve, reject) => {
          response.body.pipe(fileStream);
          response.body.on('error', reject);
          fileStream.on('finish', resolve);
        });
        return `Explanation ${comicId} success`;
      } catch (error) {
        console.warn(`Error fetching explanation for comic ${comicId}`);
        return `Explanation ${comicId} failed`;
      }
    };
    batchAPICall.requestList.push(request);
  }
}

batchAPICall.makeRequests();
