import 'dotenv/config';

const SCRAPE_REQUEST_BATCH_SIZE = parseInt(
  process.env.SCRAPE_REQUEST_BATCH_SIZE || '52'
);

// https://www.codewithyou.com/blog/how-to-implement-retry-with-exponential-backoff-in-nodejs
export function exponentialBackoffRetry(
  fn,
  { maxAttempts = 5, baseDelayMs = 1000, callback = () => {} }
) {
  let attempt = 1;

  const execute = async () => {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** attempt;
      callback({ attempt, delayMs });
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      attempt++;
      return execute();
    }
  };

  return execute();
}

export class BatchAPICall {
  constructor(batchSize = SCRAPE_REQUEST_BATCH_SIZE) {
    this.batchSize = batchSize;
  }
  requestList = [];

  async makeRequests() {
    if (this.requestList.length === 0) return console.log('No requests!');

    for (let i = 0; i <= this.requestList.length / this.batchSize + 1; i++) {
      const result = await Promise.all(
        this.requestList
          .slice((i === 0 ? 0 : i - 1) * this.batchSize, i * this.batchSize)
          .map((fn) => fn())
      );
      console.log(result);
    }
  }
}
