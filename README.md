# xkcd search

This is a demo that showcases some of Typesense's features using [xkcd](https://xkcd.com/) comics and metadata from [explain xkcd](https://www.explainxkcd.com/).

View it live here: https://findxkcd.com/

# Tech Stack

This search experience is powered by Typesense which is a fast, open source typo-tolerant search-engine. It is an open source alternative to Algolia and an easier-to-use alternative to ElasticSearch.

The app was built using the [Typesense Adapter for InstantSearch.js](https://github.com/typesense/typesense-instantsearch-adapter) and is hosted on Cloudflare Pages.

The search/browsing backend is powered by a geo-distributed 3-node Typesense cluster running on [Typesense Cloud](https://cloud.typesense.org), with nodes in Oregon, Frankfurt and Mumbai.


## Repo structure

- `src/` and `index.html` - contain the frontend UI components, built with <a href="https://github.com/typesense/typesense-instantsearch-adapter" target="_blank">Typesense Adapter for InstantSearch.js</a>
- `scripts/` - contains the scripts to extract, transform and index the data into Typesense.

## Development

1. Create a `.env` file using `.env.example` as reference.

2. Fetch Data

  ```shell
  mkdir -p data/raw
  yarn fetchData
  ```

3. Transform and index the data
  ```shell
  yarn transformData
  yarn indexData
  ```

4. Install dependencies and run the local server:

```shell
yarn
yarn start
```

Open http://localhost:3000 to see the app.

## Update data

```shell
# Delete cached files that might not have had explanations during previous run
find data/raw -name "*.html" -type f -exec grep -l "explanation may be incomplete" {} + | xargs -r rm
yarn fetchData

# Handle 503s
find data/raw -name "*.html" -type f -exec grep -l "server is temporarily unable" {} + | xargs -r rm

# Refresh and index
yarn refreshData
```

## Deployment

The app is hosted on Cloudflare Pages and is set to auto-deploy on git push
