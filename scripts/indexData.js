require('dotenv').config();

const _ = require('lodash');

const BATCH_SIZE = process.env.BATCH_SIZE || 1000;
const CHUNK_SIZE = process.env.CHUNK_SIZE || 3;
const MAX_LINES = process.env.MAX_LINES || Infinity;
const DATA_FILE = process.env.DATA_FILE || './data/transformed_dataset.jsonl';

const fs = require('fs');
const readline = require('readline');
const Typesense = require('typesense');

async function addRecordsToTypesense(records, typesense, collectionName) {
  try {
    const returnDataChunks = await Promise.all(
      _.chunk(records, Math.ceil(records.length / CHUNK_SIZE)).map(
        (recordsChunk) => {
          return typesense
            .collections(collectionName)
            .documents()
            .import(recordsChunk.join('\n'));
        }
      )
    );

    const failedItems = returnDataChunks
      .map((returnData) =>
        returnData
          .split('\n')
          .map((r) => JSON.parse(r))
          .filter((item) => item.success === false)
      )
      .flat();
    if (failedItems.length > 0) {
      throw new Error(
        `Error indexing items ${JSON.stringify(failedItems, null, 2)}`
      );
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = (async () => {
  const typesense = new Typesense.Client({
    nodes: [
      {
        host: process.env.TYPESENSE_HOST,
        port: process.env.TYPESENSE_PORT,
        protocol: process.env.TYPESENSE_PROTOCOL,
      },
    ],
    apiKey: process.env.TYPESENSE_ADMIN_API_KEY,
  });

  const collectionName = `xkcd_${Date.now()}`;
  const schema = {
    name: collectionName,
    fields: [
      { name: 'id', type: 'string' },
      { name: 'title', type: 'string' },
      { name: 'transcript', type: 'string' },
      { name: 'altTitle', type: 'string' },
      { name: 'publishDateYear', type: 'int32', facet: true },
      { name: 'publishDateMonth', type: 'int32', facet: true },
      { name: 'publishDateDay', type: 'int32', facet: true },
      { name: 'publishDateTimestamp', type: 'int64', facet: true },
      { name: 'topics', type: 'string[]', facet: true },
      // { name: 'imageUrl'},
    ],
    default_sorting_field: 'publishDateTimestamp',
  };

  console.log(`Populating new collection in Typesense ${collectionName}`);

  console.log('Creating schema: ');
  await typesense.collections().create(schema);

  console.log('Adding records: ');

  const fileStream = fs.createReadStream(DATA_FILE);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let records = [];
  let currentLine = 0;
  for await (const line of rl) {
    currentLine += 1;
    records.push(line);
    if (currentLine % BATCH_SIZE === 0) {
      await addRecordsToTypesense(records, typesense, collectionName);
      console.log(` Lines upto ${currentLine} ✅`);
      records = [];
    }

    if (currentLine >= MAX_LINES) {
      break;
    }
  }

  if (records.length > 0) {
    await addRecordsToTypesense(records, typesense, collectionName);
    console.log('✅');
  }

  let oldCollectionName;
  try {
    oldCollectionName = await typesense.aliases('xkcd').retrieve()[
      'collection_name'
    ];
  } catch (error) {
    // Do nothing
  }

  try {
    console.log(`Update alias xkcd -> ${collectionName}`);
    await typesense
      .aliases()
      .upsert('xkcd', { collection_name: collectionName });

    if (oldCollectionName) {
      console.log(`Deleting old collection ${oldCollectionName}`);
      await typesense.collections(oldCollectionName).delete();
    }
  } catch (error) {
    console.error(error);
  }

  // Add synonyms
  // console.log('Adding synonyms...');
  // const synonyms = [
  //   {
  //     synonyms: ['regex', 'regular expression', 'regular expression'],
  //   },
  // ];
  //
  // for (const synonym of synonyms) {
  //   await typesense
  //     .collections('xkcd')
  //     .synonyms()
  //     .upsert(synonym.synonyms[0], synonym);
  // }
  //
  // console.log('✅');
})();
