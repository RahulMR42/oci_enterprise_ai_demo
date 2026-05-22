terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 7.20.0"
    }
  }
}

provider "oci" {
  region = var.region
}
