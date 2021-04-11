const express = require('express');
const PORT = process.env.PORT || 5000;

const api = require('./api/api');

const app = express();
app.use('/api', api);
app.listen(PORT);
