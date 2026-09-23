# The database has no public address, so the schema can only be applied from
# inside the VPC. This packages db/ as a Lambda that bin/deploy-backend.sh
# invokes once after apply. Deliberately no Function URL and no CloudFront
# origin: it is reachable only through the AWS API, by whoever ran the deploy.
module "lambda_migrate" {
  count   = data.aws_caller_identity.this.id != "000000000000" && var.aws_postgres_enabled ? 1 : 0
  source  = "terraform-aws-modules/lambda/aws"
  version = "~> 8.0"

  function_name   = format("%s-migrate-%s", var.aws_project, local.app_id)
  package_type    = "Zip"
  architectures   = ["x86_64"]
  handler         = "function.handler"
  runtime         = "python3.13"
  memory_size     = 512
  timeout         = 900 # the seed writes ~900 incidents a row at a time
  build_in_docker = true
  lambda_role     = local.lambda_role_arn
  store_on_s3     = true
  s3_bucket       = format("%s-tfstate-%s", var.aws_project, local.app_id)
  s3_prefix       = format("lambda/%s/migrate/", local.app_id)

  source_path = [{
    path             = abspath(format("%s/../db", path.module))
    patterns         = ["!__pycache__/.*", "!\\..*", "!test_.*"]
    pip_requirements = true
  }]

  vpc_security_group_ids = data.aws_security_groups.this.ids
  vpc_subnet_ids         = local.public_subnet_ids
  attach_network_policy  = true

  create_package                    = true
  create_role                       = false
  attach_cloudwatch_logs_policy     = true
  cloudwatch_logs_retention_in_days = 7
  trigger_on_package_timestamp      = false

  environment_variables = {
    for key, value in local.env_vars :
    key => trimspace(value) if try(trimspace(value), "") != ""
  }

  tags = local.app_tags
}
