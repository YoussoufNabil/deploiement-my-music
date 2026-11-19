resource "aws_ssm_parameter" "db_password" {
  name        = "/my-music/prod/db_password"
  description = "RDS master password used by the My Music application"
  type        = "SecureString"
  value       = var.db_password
  tags        = { Project = "my-music" }
}

resource "random_password" "jwt_secret" {
  length           = 48
  special          = true
  override_special = "-_+"
}

resource "aws_ssm_parameter" "jwt_secret" {
  name        = "/my-music/prod/jwt_secret"
  description = "JWT signing secret for My Music"
  type        = "SecureString"
  value       = random_password.jwt_secret.result
  tags        = { Project = "my-music" }
}

resource "aws_ssm_parameter" "app_db_password" {
  name        = "/my-music/prod/app_db_password"
  description = "Password for the least-privilege My Music database user"
  type        = "SecureString"
  value       = var.app_db_password
  tags        = { Project = "my-music" }
}
