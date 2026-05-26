output "build_pipeline_id" {
  description = "OCI DevOps build pipeline OCID."
  value       = var.enabled ? oci_devops_build_pipeline.this[0].id : ""
}

output "build_run_id" {
  description = "OCI DevOps build run OCID started by Resource Manager."
  value       = var.enabled && var.run_build ? oci_devops_build_run.this[0].id : ""
}

output "source_repository_id" {
  description = "OCI DevOps source repository OCID created for the hosted image build."
  value       = var.enabled && var.create_devops_repository ? oci_devops_repository.source[0].id : var.source_repository_id
}

output "ocir_namespace" {
  description = "OCIR namespace used by hosted image builds."
  value       = var.enabled ? data.oci_objectstorage_namespace.this[0].namespace : ""
}

output "image_repository_uris" {
  description = "OCIR repository URIs pushed by the DevOps build."
  value = var.enabled ? {
    for name, repository in local.repositories :
    name => "${var.ocir_region_key}.ocir.io/${data.oci_objectstorage_namespace.this[0].namespace}/${repository}"
  } : {}
}
