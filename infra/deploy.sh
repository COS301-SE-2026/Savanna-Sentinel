#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Commit SHA or tag argument required"
  exit 1
fi

if [[ -z "${2:-}" ]]; then
  echo "AWS region argument required"
  exit 1
fi

export IMAGE_TAG="$1"
AWS_REGION="$2"

cd "$(dirname "$0")/.."

git fetch origin
git checkout "$IMAGE_TAG"

export ECR_REGISTRY="$(aws sts get-caller-identity --query Account --output text).dkr.ecr.${AWS_REGION}.amazonaws.com"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker compose -f docker-compose.yml --profile prod pull
docker compose -f docker-compose.yml --profile prod up -d
docker image prune -f
