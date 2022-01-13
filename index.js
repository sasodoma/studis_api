const logError = require('./log_error');
const StudisClient = require('./studis_client');
const express = require('express');
const app = express();
const http = require('http').createServer(app);

const secrets = require('./secrets.json');

http.listen(3604);

const client = new StudisClient();

client.begin(secrets.Username, secrets.Password);

app.get('/', ((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    client.getData().then(json => res.send(JSON.stringify(json, null, 2))).catch(logError);
}));