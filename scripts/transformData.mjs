import * as cheerio from 'cheerio';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { DateTime } from 'luxon';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data/raw');
const transformedDataWriteStream = fs.createWriteStream(
  path.resolve(DATA_DIR, '..', 'transformed_dataset.jsonl')
);

const dir = fs.opendirSync(DATA_DIR);
let dirent;
while ((dirent = dir.readSync()) !== null) {
  if (!dirent.name.endsWith('.html')) {
    continue;
  }
  console.log(`Transforming ${dirent.name}`);
  const explainXkcdFileContents = fs
    .readFileSync(path.resolve(DATA_DIR, dirent.name))
    .toString();
  const $ = cheerio.load(explainXkcdFileContents);
  const [id, title] = $('#firstHeading').text().split(': ');

  const xkcdInfoContents = fs
    .readFileSync(path.resolve(DATA_DIR, `${id}.json`))
    .toString();
  let transcript = '';

  // Read all text in <dl> elements after h1#Transcript
  let currentDomElement = $('#Transcript').parent().next();
  while (
    currentDomElement.length > 0 &&
    currentDomElement.prop('tagName') === 'DL'
  ) {
    transcript +=
      currentDomElement
        .text()
        .replace(/^|\n\b.*?\b: /g, ' ') // Remove Speaker Names that have the pattern "Speaker: " since it throws off relevancy
        .replace(/\s*\[.*?\]\s*/g, '') // Remove explainers within [...] since it throws off relevancy
        .trim() + ' ';
    currentDomElement = currentDomElement.next();
  }

  let xkcdInfo;
  if (id === '404') {
    xkcdInfo = {
      img: 'https://www.explainxkcd.com/wiki/images/9/92/not_found.png',
      month: '4',
      year: '2008',
      day: '1',
      alt: '404 Not Found',
    };
  } else {
    xkcdInfo = JSON.parse(xkcdInfoContents);
  }

  const altTitle = xkcdInfo['alt'];
  const publishDateObject = DateTime.local(
    parseInt(xkcdInfo['year']),
    parseInt(xkcdInfo['month']),
    parseInt(xkcdInfo['day'])
  );
  const publishDateYear = publishDateObject.year;
  const publishDateMonth = publishDateObject.month;
  const publishDateDay = publishDateObject.day;
  const publishDateTimestamp = publishDateObject.toSeconds();
  const topics = $('#catlinks ul li a')
    .toArray()
    .map((e) => e.firstChild.nodeValue)
    .slice(4); // First 4 are not topics
  const normalizedTopics = topics.map((t) =>
    t.replace(/^Comics featuring /g, '')
  );

  const record = {
    id,
    title,
    transcript,
    altTitle,
    publishDateYear,
    publishDateMonth,
    publishDateDay,
    publishDateTimestamp,
    topics: normalizedTopics,
    imageUrl: xkcdInfo['img'],
  };
  transformedDataWriteStream.write(JSON.stringify(record) + '\n');
}

transformedDataWriteStream.end();
dir.closeSync();
