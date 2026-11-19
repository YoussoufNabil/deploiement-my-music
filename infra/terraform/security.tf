resource "aws_security_group" "ec2" {
  name        = "my-music-ec2-sg"
  description = "Application EC2 security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "SSH restricted to administrator CIDR; use SSM when possible"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.my_ip]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "My Music application port (restrict for production)"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = var.app_allowed_cidr
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "my-music-ec2-sg" }
}

resource "aws_security_group" "rds" {
  name        = "my-music-rds-sg"
  description = "Allow MySQL only from the application EC2 security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "MySQL from application EC2 only"
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "my-music-rds-sg" }
}
