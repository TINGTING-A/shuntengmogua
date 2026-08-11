const Database = require('better-sqlite3');
const db = new Database('/home/an/瓜达AI工作站/guada_ai-master/backend-ts/data/ai_chat.db', { readonly: true });
const cols = db.prepare("PRAGMA table_info(model_provider)").all().map(c => c.name);
console.log('cols:', cols.join(','));
const rows = db.prepare("SELECT * FROM model_provider").all();
for (const r of rows) {
  const brief = {};
  for (const k of Object.keys(r)) {
    const v = r[k];
    if (typeof v === 'string' && /key|secret|token/i.test(k)) brief[k] = v.slice(0, 12) + '...';
    else if (typeof v === 'string' && v.length > 60) brief[k] = v.slice(0, 60) + '...';
    else brief[k] = v;
  }
  console.log(JSON.stringify(brief));
}
