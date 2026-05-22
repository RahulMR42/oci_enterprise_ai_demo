locals {
  control_plane_base_url    = "https://generativeai.${var.region}.oci.oraclecloud.com/20231130"
  openai_base_url           = "https://inference.generativeai.${var.region}.oci.oraclecloud.com/openai/v1"
  vector_store_display_name = "${var.vector_store_display_name}-${var.resource_suffix}"
  seed_pdf_dir              = "${path.module}/assets/pdfs"
  seed_pdf_files            = sort(fileset(local.seed_pdf_dir, "*.pdf"))
  seed_pdf_manifest = [
    for file_name in local.seed_pdf_files : {
      name   = file_name
      path   = "${local.seed_pdf_dir}/${file_name}"
      sha256 = filesha256("${local.seed_pdf_dir}/${file_name}")
    }
  ]
}
