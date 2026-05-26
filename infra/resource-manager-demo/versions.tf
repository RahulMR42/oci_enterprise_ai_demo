terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source = "oracle/oci"
    }
    random = {
      source = "hashicorp/random"
    }
    local = {
      source = "hashicorp/local"
    }
  }
}

provider "oci" {
  region = var.region
}
