import getpass
import hashlib
import json
import re

hashes = {}
for player in ("blathers", "disastrum"):
    code = getpass.getpass(f"{player} player ID: ").strip()
    if not re.fullmatch(r"[0-9]{16}", code):
        raise SystemExit("Player IDs must be exactly 16 digits.")
    hashes[player] = hashlib.sha256(code.encode()).hexdigest()
print(json.dumps(hashes))
