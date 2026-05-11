import postgres from 'postgres';
const sql = postgres('postgresql://postgres:T8qJfK2z)8_Kr@db.tyimzyylyawbdhmmlubu.supabase.co:5432/postgres', { ssl: 'require' });
sql`SELECT 1`.then(() => { console.log('Connected!'); process.exit(0); }).catch(e => { console.error('Error:', e.message); process.exit(1); });
