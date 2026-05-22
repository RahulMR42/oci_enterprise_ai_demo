# NL2SQL / SQL Search infrastructure

This module provisions the database-side foundation for the portal's NL2SQL / SQL Search feature.

## Resources

- Autonomous Database for sample structured data.
- Randomly generated Autonomous Database ADMIN password.
- Managed Vault, key, and password secret when `database_password_secret_id` is omitted.
- Database Tools enrichment connection.
- Database Tools query connection.

Shared IAM is handled by `infra/shared-demo-security`. That module creates the reusable dynamic group and compartment policy used across demos.

## Usage

```bash
terraform -chdir=infra/nl2sql-sql-search init
terraform -chdir=infra/nl2sql-sql-search apply \
  -var='compartment_id=<compartment-ocid>'
```

If you pass `database_password_secret_id`, Terraform uses that existing secret for Database Tools. If you omit it, Terraform creates a Vault, key, and secret from the generated ADB password.

After apply, use the enrichment and query Database Tools connection IDs to create the OCI Generative AI Semantic Store for NL2SQL.
