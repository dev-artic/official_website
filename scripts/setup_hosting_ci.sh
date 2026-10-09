#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != "--apply" ]]; then
  echo 'Requires approval for the IAM changes documented in docs/private-hosting.md.'
  echo 'After approval: bash scripts/setup_hosting_ci.sh --apply'
  exit 1
fi
command -v gcloud >/dev/null
command -v gh >/dev/null

project='artic-official-home'
number='259485663128'
repo='dev-artic/official_website'
repo_id='953382197'
owner_id='201251886'
pool='artic-github'
provider='hosting'
service_account="github-hosting-deploy@${project}.iam.gserviceaccount.com"
condition="assertion.repository_id == '$repo_id' && assertion.repository_owner_id == '$owner_id' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '$repo/.github/workflows/deploy-hosting.yml@refs/heads/main' && assertion.event_name in ['push', 'workflow_dispatch']"

# Each step fails closed; billing, application secrets and database permissions are untouched.
gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$project"
if ! gcloud iam service-accounts describe "$service_account" --project "$project" >/dev/null 2>&1; then
  gcloud iam service-accounts create github-hosting-deploy --display-name 'artic. GitHub static Hosting deploy' --project "$project"
fi
if ! gcloud iam workload-identity-pools describe "$pool" --location global --project "$project" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$pool" --location global --display-name 'artic. GitHub' --project "$project"
fi
if ! gcloud iam workload-identity-pools providers describe "$provider" --workload-identity-pool "$pool" --location global --project "$project" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$provider" --workload-identity-pool "$pool" --location global --project "$project" \
    --issuer-uri 'https://token.actions.githubusercontent.com' \
    --attribute-mapping 'google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id' \
    --attribute-condition "$condition"
fi
gcloud iam workload-identity-pools providers update-oidc "$provider" --workload-identity-pool "$pool" --location global --project "$project" --attribute-condition "$condition"
gcloud projects add-iam-policy-binding "$project" --member "serviceAccount:$service_account" --role roles/firebasehosting.admin --condition None --quiet >/dev/null
gcloud projects add-iam-policy-binding "$project" --member "serviceAccount:$service_account" --role roles/serviceusage.serviceUsageConsumer --condition None --quiet >/dev/null
gcloud iam service-accounts add-iam-policy-binding "$service_account" --project "$project" \
  --member "principalSet://iam.googleapis.com/projects/$number/locations/global/workloadIdentityPools/$pool/attribute.repository_id/$repo_id" \
  --role roles/iam.workloadIdentityUser --quiet >/dev/null
gh variable set FIREBASE_WORKLOAD_IDENTITY_PROVIDER --repo "$repo" --body "projects/$number/locations/global/workloadIdentityPools/$pool/providers/$provider"
gh variable set FIREBASE_DEPLOY_SERVICE_ACCOUNT --repo "$repo" --body "$service_account"
echo 'OIDC configured. Set FIREBASE_DEPLOY_ENABLED=true only after the reviewed workflow is on main.'
