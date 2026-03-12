# PyInstaller spec for the independent AgentCore Lobster sidecar adapter
from pathlib import Path

block_cipher = None
repo_root = Path.cwd().parent
skills_root = repo_root / "lobster-src" / "SKILLs"

datas = []
if skills_root.exists():
    datas.append((str(skills_root / "skills.config.json"), "lobster-src/SKILLs"))
    for skill_md in skills_root.glob("*/SKILL.md"):
        datas.append((str(skill_md), f"lobster-src/SKILLs/{skill_md.parent.name}"))

a = Analysis(
    ["main.py"],
    pathex=[],
    binaries=[],
    hiddenimports=[
        "uvicorn",
        "fastapi",
        "pydantic",
        "httpx",
        "multipart",
    ],
    datas=datas,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="lobster_engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
