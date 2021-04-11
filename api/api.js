const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

router.get('/press', (req, res) => {
  fs.readFile(
    path.join(__dirname, '../data/press.json'),
    'utf8',
    (err, data) => {
      if (err) {
        throw err;
      }
      const press = JSON.parse(data);
      res.json(press);
    }
  );
});

module.exports = router;
