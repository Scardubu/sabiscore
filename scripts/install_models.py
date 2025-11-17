#!/usr/bin/env python3
"""Install real model artifacts from a local directory into the repo for use by the backend.

This is intended for operators who have the actual trained model .pkl files locally
and want to replace the dummy artifacts used for development. It copies files into
`backend/models/` (and processed data into `backend/data/processed/`) and runs
the validator to ensure the backend will accept them.

Usage:
  python scripts/install_models.py --source /path/to/artifacts

The source directory should mirror the artifact layout, e.g.:
  models/epl_ensemble.pkl
  models/serie_a_ensemble.pkl
  data/processed/epl_training.csv

After running, start the backend normally.
"""
import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def copy_artifacts(src: Path, dest_root: Path) -> bool:
    if not src.exists():
        print(f"Source path not found: {src}")
        return False

    # Walk source tree and copy files into dest_root preserving relative paths
    copied = 0
    for root, dirs, files in os.walk(src):
        for f in files:
            rel = Path(root).joinpath(f).relative_to(src)
            dest = dest_root.joinpath(rel)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(Path(root).joinpath(f), dest)
            copied += 1

    print(f"Copied {copied} files from {src} to {dest_root}")
    return True


def run_validator(models_dir: Path, timeout: int = 20) -> int:
    cmd = [sys.executable, str(Path(__file__).resolve().parent.joinpath('validate_models.py')), '--models-dir', str(models_dir), '--timeout', str(timeout)]
    print('Running validator:', ' '.join(cmd))
    return subprocess.call(cmd)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, help='Local source directory containing artifacts')
    parser.add_argument('--repo-root', default=os.getcwd(), help='Repository root (default: cwd)')
    parser.add_argument('--timeout', type=int, default=20, help='Validator timeout per file')
    args = parser.parse_args()

    src = Path(args.source).expanduser().resolve()
    repo_root = Path(args.repo_root).resolve()
    backend_root = repo_root.joinpath('backend')
    if not backend_root.exists():
        print('Error: cannot find backend directory at', backend_root)
        sys.exit(2)

    print(f'Installing artifacts from {src} into {backend_root}')
    ok = copy_artifacts(src, backend_root)
    if not ok:
        sys.exit(3)

    models_dir = backend_root.joinpath('models')
    code = run_validator(models_dir, timeout=args.timeout)
    if code != 0:
        print('Validation failed, please inspect validation-summary.json in', models_dir)
        sys.exit(code)

    print('Models installed and validated. Start the backend:')
    print('  cd backend')
    print('  uvicorn src.api.main:app --host 0.0.0.0 --port 8000')


if __name__ == '__main__':
    main()
