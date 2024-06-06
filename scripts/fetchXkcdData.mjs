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
  const filePath = `${DATA_DIR}/${comicId}.json`;
  if (fs.existsSync(filePath)) {
    console.log(`Comic ${comicId} already exists. Skipping.`);
    continue;
  }
  if (comicId === 404) {
    // id 404 is an April fools joke
    const writer = fs.createWriteStream(filePath);
    writer.write('{}');
    continue;
  }
  const request = async () => {
    const fetchInfo = async () => {
      console.log(`Fetching info for comic ${comicId}.`);
      const res = await fetch(`https://xkcd.com/${comicId}/info.0.json`);

      if (!res.ok) throw new Error('Request failed!');
      return res;
    };

    try {
      const response = await exponentialBackoffRetry(fetchInfo, {
        callback: ({ attempt, delayMs }) =>
          console.log(
            `Retry fetching info for comic ${comicId}: attempt ${attempt} after ${delayMs}ms`
          ),
      });
      // 🙏 https://stackoverflow.com/a/51302466/123545
      const fileStream = fs.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on('error', reject);
        fileStream.on('finish', resolve);
      });
      return `Comic info ${comicId} success`;
    } catch (error) {
      console.warn(`Error fetching explanation for comic ${comicId}`);
      return `Comic info ${comicId} failed`;
    }
  };

  batchAPICall.requestList.push(request);
}

batchAPICall.makeRequests();
