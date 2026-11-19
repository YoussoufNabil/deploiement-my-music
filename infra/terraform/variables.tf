variable "aws_region" {
  description = "AWS region for the My Music stack."
  type        = string
  default     = "us-east-1"
}

variable "my_ip" {
  description = "IPv4 CIDR allowed to use SSH. SSM is the recommended administration path."
  type        = string
  default     = "127.0.0.1/32"
}

variable "app_allowed_cidr" {
  description = "CIDR allowed to reach the application port. The report used 0.0.0.0/0 for its HTTP test. Restrict this for real deployments."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "ec2_instance_type" {
  description = "EC2 instance type for the single application server."
  type        = string
  default     = "t3.micro"
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t3.micro"
}

variable "db_username" {
  description = "RDS master username."
  type        = string
  default     = "admin"
}

variable "db_password" {
  description = "Strong RDS master password; store the tfvars file securely."
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.db_password) >= 16
    error_message = "db_password must contain at least 16 characters."
  }
}

variable "app_port" {
  description = "Application container port exposed on EC2."
  type        = number
  default     = 3000
}

variable "app_db_password" {
  description = "Strong password for the least-privilege MySQL application user app_user."
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.app_db_password) >= 16
    error_message = "app_db_password must contain at least 16 characters."
  }
}
