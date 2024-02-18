import { promises as fs } from 'fs';

const getLocalJson = async (relativePath) => {
  const data = await fs.readFile(
    new URL(relativePath, import.meta.url),
    'utf8',
  );
  return JSON.parse(data);
};

export default getLocalJson;
