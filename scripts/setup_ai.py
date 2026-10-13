"""Run interactively in your own terminal. Never pass a key as a command argument."""

import argparse
import getpass
import os
import sys
import tempfile
from pathlib import Path

from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
DEFAULTS = {
    "groq": ("GROQ_API_KEY", "GROQ_MODEL", "openai/gpt-oss-120b"),
    "openai": ("OPENAI_API_KEY", "OPENAI_MODEL", "gpt-4o-mini"),
}


def save_key(path, provider, key):
    if not key or any(c.isspace() for c in key) or "'" in key or '"' in key:
        raise ValueError("Enter a non-empty API key without spaces or quotes")
    if path.is_symlink():
        raise ValueError("Refusing to replace a symbolic-link configuration file")
    key_name, model_name, model = DEFAULTS[provider]
    current = dotenv_values(path) if path.exists() else {}
    replacements = {
        "AI_PROVIDER": provider,
        key_name: key,
        model_name: current.get(model_name) or model,
    }
    lines = path.read_text().splitlines() if path.exists() else []
    # Keep other settings and comments intact. Replace duplicate assignments safely.
    kept = [
        line
        for line in lines
        if line.strip().removeprefix("export ").split("=", 1)[0].strip() not in replacements
    ]
    kept.extend(f"{name}='{value}'" for name, value in replacements.items())
    fd, temporary = tempfile.mkstemp(prefix=".ai-setup-", dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, "w") as out:
            out.write("\n".join(kept) + "\n")
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=DEFAULTS, default="groq")
    args = parser.parse_args()
    if not sys.stdin.isatty():
        print("Run this in your own interactive terminal; keys are never accepted from a pipe.")
        return 1
    print(f"Configure {args.provider} for synthetic demonstrations only.")
    print("Paste the API key at the hidden prompt. It will not be displayed.")
    try:
        key = getpass.getpass("API key: ").strip()
        save_key(ROOT / ".env", args.provider, key)
    except (ValueError, EOFError, KeyboardInterrupt):
        print("\nSetup cancelled or invalid key format. No key is displayed.")
        return 1
    print("Saved privately to the project .env (owner read/write only).")
    print("Restart the backend, then run: .venv/bin/python -m scripts.check_ai")
    print("Configuration is saved; a successful connection has not yet been verified.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
