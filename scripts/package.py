"""Create an unpacked-extension release; never include profiles or user PDFs."""
from pathlib import Path
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
version = json.loads((ROOT / 'extension/manifest.json').read_text(encoding='utf-8'))['version']
output = ROOT / 'dist' / f'job-mail-assistant-edge-v{version}.zip'
output.parent.mkdir(exist_ok=True)
files = sorted(p for p in (ROOT / 'extension').rglob('*') if p.is_file())
assert not any(p.suffix.lower() in {'.pdf', '.env', '.log'} for p in files), 'Private file detected'
files += [ROOT / name for name in ['README.md', 'PRIVACY.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'vendor-checksums.json']]
with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for file in files:
        archive.write(file, file.relative_to(ROOT).as_posix())
with zipfile.ZipFile(output) as archive:
    assert archive.testzip() is None
print(output)
