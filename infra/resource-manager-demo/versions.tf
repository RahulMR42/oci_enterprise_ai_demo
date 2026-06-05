terraform {
  required_version = ">= 1.5.0"

  required_providers {
    oci = {
      source = "oracle/oci"
    }
    random = {
      source = "hashicorp/random"
    }
    external = {
      source = "hashicorp/external"
    }
    time = {
      source = "hashicorp/time"
    }
  }
}

provider "oci" {
  region = var.region
}
