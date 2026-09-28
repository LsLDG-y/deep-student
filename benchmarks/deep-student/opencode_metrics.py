"""Read only candidate-session metrics, never credentials, from OpenCode v2."""
from __future__ import annotations

import json
from pathlib import Path
import sqlite3


def session_metrics(controller: Path, session_ids: list[str]) -> dict:
    path = controller / 'data/opencode/opencode.db'
    result = {'source': 'OpenCode v2 local session records',
              'cost_note': 'Client-reported estimates, not a provider invoice. Session totals may include auxiliary calls.',
              'sessions': [], 'assistant_messages': []}
    if not path.is_file():
        result['error'] = 'OpenCode session database not present'
        return result
    try:
        with sqlite3.connect(path.as_uri() + '?mode=ro', uri=True) as connection:
            connection.row_factory = sqlite3.Row
            for session_id in session_ids:
                row = connection.execute(
                    'SELECT id, model, cost, tokens_input, tokens_output, tokens_reasoning, '
                    'tokens_cache_read, tokens_cache_write, time_idle, idle_outcome '
                    'FROM session_v2 WHERE id = ?', (session_id,)).fetchone()
                if row is not None:
                    item = dict(row)
                    item['model'] = json.loads(item['model']) if item['model'] else None
                    result['sessions'].append(item)
                for row in connection.execute(
                        "SELECT id, seq, data FROM session_message WHERE session_id = ? "
                        "AND type = 'assistant' ORDER BY seq", (session_id,)):
                    data = json.loads(row['data'])
                    result['assistant_messages'].append({
                        'id': row['id'], 'session_id': session_id, 'seq': row['seq'],
                        **{key: data.get(key) for key in ('model', 'cost', 'tokens', 'finish', 'error')},
                    })
    except (sqlite3.Error, ValueError, TypeError) as exc:
        result['error'] = f'{type(exc).__name__}: {exc}'
    return result
