moved {
  from = oci_identity_domains_app.n8n_launch_client
  to   = oci_identity_domains_app.hosted_app_launch_client
}

moved {
  from = terraform_data.n8n_idcs_launch_client_metadata
  to   = terraform_data.hosted_app_idcs_launch_client_metadata
}
