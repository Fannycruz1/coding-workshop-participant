resource "random_id" "this" {
  byte_length = 4

  keepers = {
    seed_input = try(var.aws_app_code, terraform.workspace)
  }
}

resource "random_pet" "this" {
  length    = 3
  separator = "-"

  keepers = {
    seed_input = try(var.aws_app_code, terraform.workspace)
  }
}

resource "random_password" "this" {
  length  = 48
  special = false

  keepers = {
    seed_input = try(var.aws_app_code, terraform.workspace)
  }
}
