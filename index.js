const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 5000;

const paginated = require('./api/utils/middleware');
const api = require('./api/api');

const app = express();
app.use(cors());
app.all('*', paginated);
app.use('/api', api);
app.listen(PORT);
