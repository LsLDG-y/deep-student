"""Run actual production migration in SQLite, including its historical dedup index."""
import os, sqlite3, unittest
from pathlib import Path
ROOT=Path(os.environ['DS_SOURCE_ROOT'])
SQL=ROOT/'src-tauri/migrations/mistakes/V20260824__normalize_anki_card_optional_json.sql'
class Migration(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:')
  self.db.executescript('''CREATE TABLE anki_cards (
  id TEXT PRIMARY KEY, source_type TEXT, source_id TEXT, text TEXT, front TEXT, back TEXT,
  is_error_card INTEGER NOT NULL DEFAULT 0, deleted_at TEXT, updated_at TEXT, created_at TEXT,
  tags_json TEXT, images_json TEXT, extra_fields_json TEXT);
  CREATE UNIQUE INDEX idx_anki_cards_dedup_unique ON anki_cards(source_type,source_id,
  CASE WHEN source_type='apkg_import' THEN id WHEN text IS NOT NULL AND length(text)>0 THEN text
  ELSE printf('%d:%s|%s',length(front),front,back) END)
  WHERE is_error_card=0 AND deleted_at IS NULL;''')
 def add(self,id,source_type=None,source_id=None,text='same',updated='2026-07-01',deleted=None,error=0,extra='{"_qa_flags":{"quality":"ok"}}'):
  self.db.execute('INSERT INTO anki_cards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',(id,source_type,source_id,text,'front','back',error,deleted,updated,'2026-06-01',None,'',extra))
 def migrate(self):self.db.executescript(SQL.read_text())
 def test_regression_null_source_duplicates_upgrade(self):
  self.add('old',updated='2026-07-01');self.add('winner','', '',updated='2026-08-01');self.add('middle',updated='2026-07-20')
  self.migrate()
  self.assertEqual(self.db.execute('SELECT id FROM anki_cards WHERE deleted_at IS NULL').fetchall(),[('winner',)])
  self.assertEqual(self.db.execute("SELECT count(*) FROM anki_cards WHERE source_type='' AND source_id=''").fetchone()[0],3)
  self.assertEqual(self.db.execute('SELECT updated_at FROM anki_cards WHERE id="old"').fetchone()[0],'2026-07-01')
 def test_pass_to_pass_distinct_imports_and_preserved_metadata(self):
  self.add('one','apkg_import','bundle');self.add('two','apkg_import','bundle')
  self.add('error',error=1);self.add('deleted',deleted='2026-08-01')
  self.add('separate','manual','x',text='other',extra=' {"_occlusion": [1,2]} ')
  self.migrate();self.migrate()
  self.assertEqual(self.db.execute('SELECT count(*) FROM anki_cards WHERE deleted_at IS NULL').fetchone()[0],4)
  self.assertEqual(self.db.execute('SELECT tags_json,images_json,extra_fields_json FROM anki_cards WHERE id="separate"').fetchone(),('[]','[]',' {"_occlusion": [1,2]} '))
  self.assertEqual(self.db.execute('SELECT deleted_at FROM anki_cards WHERE id="deleted"').fetchone()[0],'2026-08-01')
if __name__=='__main__':unittest.main()
