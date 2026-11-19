#!/usr/bin/env bash
set -Eeuo pipefail

: "${AWS_REGION:=us-east-1}"
: "${ECR_REGISTRY:?Set ECR_REGISTRY, e.g. 123456789012.dkr.ecr.us-east-1.amazonaws.com}"
: "${ECR_REPOSITORY:=my-music}"
: "${IMAGE_TAG:=latest}"
: "${DB_HOST:?Set DB_HOST to the private RDS endpoint}"
: "${DB_USER:=admin}"
: "${DB_NAME:=my_music}"
: "${S3_BUCKET:?Set S3_BUCKET to the private uploads bucket}"
: "${DB_PASSWORD_PARAMETER:=/my-music/prod/app_db_password}"
: "${APP_PORT:=3000}"

IMAGE="${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}"

aws sts get-caller-identity --region "$AWS_REGION" >/dev/null
aws ecr get-login-password --region "$AWS_REGION" \
  | docker login --username AWS --password-stdin "$ECR_REGISTRY"

docker pull "$IMAGE"

docker stop my-music 2>/dev/null || true
docker rm my-music 2>/dev/null || true

docker run -d \
  --name my-music \
  --restart unless-stopped \
  --log-driver awslogs \
  --log-opt "awslogs-region=${AWS_REGION}" \
  --log-opt "awslogs-group=/my-music/application" \
  --log-opt "awslogs-create-stream=true" \
  -p "${APP_PORT}:3000" \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  -e AWS_REGION="$AWS_REGION" \
  -e STORAGE_DRIVER=s3 \
  -e S3_BUCKET="$S3_BUCKET" \
  -e DB_HOST="$DB_HOST" \
  -e DB_PORT=3306 \
  -e DB_USER="$DB_USER" \
  -e DB_NAME="$DB_NAME" \
  -e DB_PASSWORD_PARAMETER="$DB_PASSWORD_PARAMETER" \
  -e JWT_SECRET="$(aws ssm get-parameter --name /my-music/prod/jwt_secret --with-decryption --region "$AWS_REGION" --query 'Parameter.Value' --output text)" \
  -e COOKIE_SECURE=false \
  "$IMAGE"

docker ps --filter name=my-music
curl --fail --silent --show-error http://127.0.0.1:${APP_PORT}/health
