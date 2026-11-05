import getpass
import hashlib
import json
import re

hashes = {}
for player in ("blathers", "disastrum", "kayceenoelle"):
    code = getpass.getpass(f"{player} player ID: ").strip()
    if not re.fullmatch(r"[0-9]{16}", code):
        raise SystemExit("Player IDs must be exactly 16 digits.")
    digest = hashlib.sha256(code.encode()).hexdigest()
    if digest in hashes.values():
        raise SystemExit("Each player must have a distinct ID.")
    hashes[player] = digest
print(json.dumps(hashes))
