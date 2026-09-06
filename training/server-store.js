import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server-data.json');
const emptyDatabase = () => ({ users: {}, clients: {}, plans: {} });

export function loadDatabase() {
  try {
    const database = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    if (!database || typeof database !== 'object') return emptyDatabase();
    return {
      users: database.users && typeof database.users === 'object' ? database.users : {},
      clients: database.clients && typeof database.clients === 'object' ? database.clients : {},
      plans: database.plans && typeof database.plans === 'object' ? database.plans : {}
    };
  } catch {
    return emptyDatabase();
  }
}

export function saveDatabase(database) {
  const temporaryPath = `${dataPath}.tmp`;
  fs.writeFileSync(temporaryPath, JSON.stringify(database, null, 2), { mode: 0o600 });
  fs.renameSync(temporaryPath, dataPath);
  fs.chmodSync(dataPath, 0o600);
}
