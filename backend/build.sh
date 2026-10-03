#!/usr/bin/env bash
# Prepara backend/build/documentos: código + dependencias para Linux (Lambda).
# Terraform empaqueta esa carpeta en el zip. Lo ejecuta el workflow antes de terraform.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf build/documentos
mkdir -p build/documentos

pip install -r documentos/requirements.txt -t build/documentos \
  --platform manylinux2014_x86_64 --implementation cp --python-version 3.12 \
  --only-binary=:all: --upgrade --no-compile

cp documentos/lambda_function.py build/documentos/
