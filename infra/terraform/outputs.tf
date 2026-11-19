output "ec2_instance_id" {
  description = "EC2 instance ID for SSM Session Manager and GitHub Actions deployment."
  value       = aws_instance.app.id
}

output "ec2_public_ip" {
  description = "Elastic IP attached to the application instance."
  value       = aws_eip.app.public_ip
}

output "rds_endpoint" {
  description = "Private RDS endpoint (host:port)."
  value       = aws_db_instance.main.endpoint
}

output "rds_hostname" {
  description = "Private RDS hostname for the application environment."
  value       = aws_db_instance.main.address
}

output "s3_bucket_name" {
  description = "Private bucket for audio uploads and cover images."
  value       = aws_s3_bucket.uploads.bucket
}

output "ecr_repository_url" {
  description = "Private ECR repository URI for the application image."
  value       = aws_ecr_repository.app.repository_url
}

output "db_password_parameter_name" {
  description = "SSM SecureString parameter name for the RDS password."
  value       = aws_ssm_parameter.db_password.name
}

output "jwt_secret_parameter_name" {
  description = "SSM SecureString parameter name for the application JWT secret."
  value       = aws_ssm_parameter.jwt_secret.name
}

output "app_db_password_parameter_name" {
  description = "SSM SecureString parameter name for the least-privilege application DB user password."
  value       = aws_ssm_parameter.app_db_password.name
}
