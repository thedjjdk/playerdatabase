import getpass
import hashlib
import json
import re

hashes = {}
for player in ("blathers", "disastrum"):
    code = getpass.getpass(f"{player} player ID: ").strip()
    if not re.fullmatch(r"[A-Za-z0-9_-]{22}", code):
        raise SystemExit("Player IDs must be 22 characters.")
    hashes[player] = hashlib.sha256(code.encode()).hexdigest()
print(json.dumps(hashes))
