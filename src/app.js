import jQuery from 'jquery';

window.$ = jQuery; // workaround for https://github.com/parcel-bundler/parcel/issues/333

import 'popper.js';
import 'bootstrap';

import instantsearch from 'instantsearch.js/es';
import {
  searchBox,
  infiniteHits,
  configure,
  stats,
  analytics,
  refinementList,
  menu,
  sortBy,
} from 'instantsearch.js/es/widgets';
import TypesenseInstantSearchAdapter from 'typesense-instantsearch-adapter';
import { SearchClient as TypesenseSearchClient } from 'typesense'; // To get the total number of docs
import STOP_WORDS from './utils/stop_words.json';
import copyToClipboard from 'copy-to-clipboard';

let TYPESENSE_SERVER_CONFIG = {
  apiKey: process.env.TYPESENSE_SEARCH_ONLY_API_KEY, // Be sure to use an API key that only allows searches, in production
  nodes: [
    {
      host: process.env.TYPESENSE_HOST,
      port: process.env.TYPESENSE_PORT,
      protocol: process.env.TYPESENSE_PROTOCOL,
    },
  ],
  numRetries: 8,
  useServerSideSearchCache: true,
};

// [2, 3].forEach(i => {
//   if (process.env[`TYPESENSE_HOST_${i}`]) {
//     TYPESENSE_SERVER_CONFIG.nodes.push({
//       host: process.env[`TYPESENSE_HOST_${i}`],
//       port: process.env.TYPESENSE_PORT,
//       protocol: process.env.TYPESENSE_PROTOCOL,
//     });
//   }
// });

// Unfortunately, dynamic process.env keys don't work with parcel.js
// So need to enumerate each key one by one

if (process.env[`TYPESENSE_HOST_2`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_2`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_3`]) {
  TYPESENSE_SERVER_CONFIG.nodes.push({
    host: process.env[`TYPESENSE_HOST_3`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  });
}

if (process.env[`TYPESENSE_HOST_NEAREST`]) {
  TYPESENSE_SERVER_CONFIG['nearestNode'] = {
    host: process.env[`TYPESENSE_HOST_NEAREST`],
    port: process.env.TYPESENSE_PORT,
    protocol: process.env.TYPESENSE_PROTOCOL,
  };
}

const INDEX_NAME = process.env.TYPESENSE_COLLECTION_NAME;

async function getIndexSize() {
  let typesenseSearchClient = new TypesenseSearchClient(
    TYPESENSE_SERVER_CONFIG
  );
  let results = await typesenseSearchClient
    .collections(INDEX_NAME)
    .documents()
    .search({ q: '*' });

  return results['found'];
}

let indexSize;

(async () => {
  indexSize = await getIndexSize();
})();

function queryWithoutStopWords(query) {
  const words = query.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').split(' ');
  return words
    .map((word) => {
      if (STOP_WORDS.includes(word.toLowerCase())) {
        return null;
      } else {
        return word;
      }
    })
    .filter((w) => w)
    .join(' ')
    .trim();
}

const typesenseInstantsearchAdapter = new TypesenseInstantSearchAdapter({
  server: TYPESENSE_SERVER_CONFIG,
  // The following parameters are directly passed to Typesense's search API endpoint.
  //  So you can pass any parameters supported by the search endpoint below.
  //  queryBy is required.
  additionalSearchParameters: {
    query_by: 'title,altTitle,transcript,topics,embedding',
    query_by_weights: '127,80,80,1,1',
    num_typos: 1,
    exclude_fields: 'embedding',
    vector_query: 'embedding:([], k: 30, distance_threshold: 0.1, alpha: 0.9)',
    // prefix: false
  },
});
const searchClient = typesenseInstantsearchAdapter.searchClient;

const search = instantsearch({
  searchClient,
  indexName: INDEX_NAME,
  routing: true,
});

search.addWidgets([
  searchBox({
    container: '#searchbox',
    showSubmit: false,
    showReset: false,
    placeholder: 'type in a search term... ',
    autofocus: true,
    cssClasses: {
      input: 'form-control',
      loadingIcon: 'stroke-primary',
    },
    queryHook(query, search) {
      const modifiedQuery = queryWithoutStopWords(query);
      search(modifiedQuery);
    },
  }),

  analytics({
    pushFunction(formattedParameters, state, results) {
      window.ga(
        'set',
        'page',
        (window.location.pathname + window.location.search).toLowerCase()
      );
      window.ga('send', 'pageView');
    },
  }),

  stats({
    container: '#stats',
    templates: {
      text: ({ nbHits, hasNoResults, hasOneResult, processingTimeMS }) => {
        let statsText = '';
        if (hasNoResults) {
          statsText = 'no comics';
        } else if (hasOneResult) {
          statsText = '1 comic';
        } else {
          statsText = `${nbHits.toLocaleString()} comics`;
        }
        return `found ${statsText} ${
          indexSize ? ` from ${indexSize.toLocaleString()}` : ''
        } in ${processingTimeMS}ms.`;
      },
    },
    cssClasses: {
      text: 'text-muted',
    },
  }),
  infiniteHits({
    container: '#hits',
    cssClasses: {
      list: 'list-unstyled',
      item: 'd-flex flex-column search-result-card mb-5',
      loadMore: 'btn btn-secondary d-block mt-4',
      disabledLoadMore: 'btn btn-light mx-auto d-block mt-4',
    },
    templates: {
      item: (data) => {
        return `
            <div class="row">
              <div class="col-12">
                <h3 style="overflow-wrap: break-word;" class="text-secondary mb-1">
                  ${data.title}
                </h3>
                <div class="text-muted small">
                  <a href="https://www.xkcd.com/${
                    data.id
                  }" target="_blank" class="text-decoration-none">${
                    data.publishDateYear
                  }-${data.publishDateMonth}-${data.publishDateDay}</a>
                  • <a class="btn-copy-to-clipboard text-decoration-none" href="#" data-link="https://www.xkcd.com/${
                    data.id
                  }">Copy to Clipboard</a>
                  • <a class="text-decoration-none" target="_blank" href="https://www.explainxkcd.com/wiki/index.php/${
                    data.id
                  }">Explain</a>
                </div>
              </div>
            </div>
            <div class="mt-2 overflow-auto">
              <img src="${data.imageUrl}" />
            </div>
            <div class="mt-2 overflow-auto">
              ${data.altTitle}
            </div>
            <div class="text-muted small mt-1">
                ${data.topics
                  .map(
                    (t) =>
                      `<a href="#" class="topic text-decoration-none">${t}</a>`
                  )
                  .join(' • ')}
            </div>
        `;
      },
      empty: 'No comics found for <q>{{ query }}</q>. Try another search term.',
      showMoreText: 'Show more comics',
    },
  }),
  menu({
    container: '#comic-publication-year',
    attribute: 'publishDateYear',
    sortBy: ['name:desc'],
    cssClasses: {
      list: 'list-unstyled',
      label: 'text-dark',
      link: 'text-decoration-none',
      count: 'badge text-dark-2 ml-2',
      selectedItem: 'bg-light pl-2',
    },
  }),
  refinementList({
    container: '#comic-topic',
    attribute: 'topics',
    searchable: true,
    searchablePlaceholder: 'search topics',
    showMore: true,
    limit: 10,
    showMoreLimit: 100,
    operator: 'and',
    cssClasses: {
      searchableInput: 'form-control form-control-sm mb-2',
      searchableSubmit: 'd-none',
      searchableReset: 'd-none',
      showMore: 'btn btn-secondary btn-sm',
      list: 'list-unstyled',
      count: 'badge text-dark-2 ml-2',
      label: 'd-flex align-items-center mb-1',
      checkbox: 'mr-2',
    },
  }),
  configure({
    hitsPerPage: 5,
  }),
  sortBy({
    container: '#sort-by',
    items: [
      {
        label: 'relevancy',
        value: `${INDEX_NAME}/sort/_text_match(buckets: 10):desc,publishDateTimestamp:desc`,
      },
      {
        label: 'recent first',
        value: `${INDEX_NAME}/sort/publishDateTimestamp:desc`,
      },
      {
        label: 'oldest first',
        value: `${INDEX_NAME}/sort/publishDateTimestamp:asc`,
      },
    ],
    cssClasses: {
      select: 'custom-select custom-select-sm',
    },
  }),
]);

search.start();

search.on('render', function () {
  // Copy-to-Clipboard event handler
  $('.btn-copy-to-clipboard').on('click', handleCopyToClipboard);
  $('.topic').on('click', handleTopicClick);
});

function handleSearchTermClick(event) {
  const $searchBox = $('#searchbox input[type=search]');
  search.helper.clearRefinements();
  $searchBox.val(event.currentTarget.textContent);
  $searchBox.trigger('change');
  search.helper.setQuery($searchBox.val()).search();
  return false;
}

function handleTopicClick(event) {
  search.helper.clearRefinements();
  search.renderState[INDEX_NAME].refinementList.topics.refine(
    event.currentTarget.textContent
  );
  setTimeout(() => {
    $('html, body').animate(
      {
        scrollTop: $('#searchbox-container').offset().top,
      },
      200
    );
  }, 200);
  return false;
}

function handleCopyToClipboard() {
  copyToClipboard($(this).data('link'), {
    debug: true,
    message: 'Press #{key} to copy',
  });

  $(this).text('Done');

  setTimeout(() => {
    $(this).text('Copy to clipboard');
  }, 2000);

  return false;
}

$(async function () {
  const $searchBox = $('#searchbox input[type=search]');

  // Handle example search terms
  $('.clickable-search-term').on('click', handleSearchTermClick);
});
