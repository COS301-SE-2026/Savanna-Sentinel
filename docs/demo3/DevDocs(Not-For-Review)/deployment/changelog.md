# Changelog

### V1

- Initial Version

### V2

- Switched live domain from sslip.io to savannasentinel.co.za
- Added DNS setup step, added missing Resend/MFA vars to the backend/.env example
- Updated in both .md and .pdf
- Updated production label on the deployment diagram

### V3

- Added media.savannasentinel.co.za DNS record and Caddy site block.
- Added MEDIA_SITE_ADDRESS to the root .env, MINIO_PUBLIC_ENDPOINT/MINIO_USE_SSL/MINIO_BUCKET/
  MINIO_REGION to the backend/.env example
- Updated deployment diagrams
- added worker

### V4

- Replaced SSH-based deploy with AWS Systems Manager.
- Backend/frontend images are built and pushed to Amazon ECR in CI, no longer built on the
  instance itself
- Split the single deploy.yml into pipeline.yml -> backend-ci.yml / frontend-ci.yml -> deploy.yml.
- Swapped MinIO for SeaweedFS - same S3-compatible API.
- Updated both deployment diagrams (production and development)
