#!/usr/bin/env python3
"""Import ranked levels from the Main tab of Blathers' Google Sheet CSV export.

Usage: python scripts/sync_blathers_from_csv.py path/to/exported-main-tab.csv
This is a snapshot importer; it never writes to Google Sheets.
"""
import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'players' / 'blathers' / 'geometry-dash.json'
SOURCE_URL = 'https://docs.google.com/spreadsheets/d/1vdxDUkCPygvrdDPuT1qq17umVgLI9Vcmhr65pT5SCVI/edit'


def clean_num(value):
    raw = (value or '').replace(',', '').strip()
    return int(raw) if raw.isdigit() else None


def valid_proof_url(text):
    try:
        uri = urlparse(text.strip())
        return uri.scheme == 'https' and uri.netloc.lower() in {
            'youtu.be', 'www.youtube.com', 'youtube.com', 'm.youtube.com',
            'www.twitch.tv', 'twitch.tv', 'clips.twitch.tv',
        }
    except Exception:
        return False


def build(csv_path):
    with open(csv_path, newline='', encoding='utf-8-sig') as f:
        rows = list(csv.reader(f))
    result = []
    for sheet_row, cols in enumerate(rows, start=1):
        row = (cols + [''] * 10)
        rank_label, name = row[4].strip(), row[5].strip()
        if rank_label.startswith('Total:'):
            break  # Ignore explanatory/duplicate cells after the ranked table.
        if not re.fullmatch(r'(?:\(\d+\))?\d+', rank_label) or not name:
            continue
        rank = int(re.search(r'\d+$', rank_label).group(0))
        rating = row[6].strip()
        video_cell = row[9].strip()
        result.append({
            'rank': rank,
            'rankLabel': rank_label,
            'name': name,
            'completionYear': clean_num(row[2]),
            'enjoyment': float(rating) if re.fullmatch(r'\d+(?:\.\d+)?', rating) else None,
            'attempts': row[7].strip() or None,
            'worstFail': clean_num(row[8]),
            'timeTaken': row[1].strip() or None,
            'videoUrl': video_cell if valid_proof_url(video_cell) else None,
            'videoTitle': video_cell if video_cell and not valid_proof_url(video_cell) else None,
            'sourceRow': sheet_row,
        })
    result.sort(key=lambda x: x['rank'])
    ranks = [x['rank'] for x in result]
    if ranks != list(range(1, len(ranks) + 1)):
        raise SystemExit(f'Ranks must be unique and contiguous; found {ranks!r}')
    return {
        'schemaVersion': 1,
        'title': 'Geometry Dash List',
        'description': 'Blathers Extreme Demon List v2, ranked hardest to easiest. Rankings are rough estimates according to the source.',
        'sourceUrl': SOURCE_URL,
        'sourceTab': 'Main',
        'rankingNote': 'The source labels groupings as approximately equivalent difficulties; parenthesized ranks are kept in rankLabel.',
        'levels': result,
    }


def main():
    if len(sys.argv) != 2:
        raise SystemExit('Usage: python scripts/sync_blathers_from_csv.py /path/to/export.csv')
    doc = build(sys.argv[1])
    DEST.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Imported {len(doc["levels"])} ranked levels to {DEST}')


if __name__ == '__main__':
    main()
