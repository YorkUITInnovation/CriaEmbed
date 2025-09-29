// Set environment variables for tests
process.env.CRIA_BOT_SERVER_URL = 'http://mock-criabot-server';
process.env.CRIA_BOT_SERVER_TOKEN = 'mock-token';
process.env.THIS_APP_URL = 'http://mock-this-app';
process.env.WEB_APP_URL = 'http://mock-web-app';
process.env.DEFAULT_BOT_GREETING = 'Hello from mock bot!';
process.env.ASSETS_FOLDER_PATH = './src/assets/';
process.env.ELASTICSEARCH_HOST = 'localhost';
process.env.ELASTICSEARCH_PORT = '9200';
process.env.ELASTICSEARCH_INDEX = 'test_criaembed';
process.env.RAGFLOW_EMBED_DIM = '768'; // Note: RAGFLOW_EMBED_DIM is a number in Config, but env vars are strings.
process.env.DEBUG_ENABLED = 'false';

// No jest.mock for config here, as we are directly setting process.env