#!/usr/bin/env bash
# Prepara backend/build/: el código, las plantillas y las dependencias para Linux (Lambda).
# Terraform empaqueta esa carpeta en el zip. Lo ejecuta el workflow antes de terraform.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf build
mkdir build

pip install -r requirements.txt -t build \
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 \
  --only-binary=:all: --upgrade --no-compile

cp lambda_function.py build/
cp -r templates build/templates
rm -f build/templates/.gitkeep
