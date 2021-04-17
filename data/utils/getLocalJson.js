const fs = require('fs').promises;
const path = require('path');

const getLocalJson = async (relativePath) => {
  const data = await fs.readFile(path.join(__dirname, relativePath), 'utf8');
  return JSON.parse(data);
};

module.exports = getLocalJson;
