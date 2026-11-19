resource "aws_db_subnet_group" "main" {
  name       = "my-music-db-subnet"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "my-music-db-subnet" }
}

resource "aws_db_instance" "main" {
  identifier                 = "my-music-db"
  engine                     = "mysql"
  engine_version             = "8.0"
  instance_class             = var.db_instance_class
  allocated_storage          = 20
  storage_type               = "gp3"
  storage_encrypted          = true
  db_name                    = "my_music"
  username                   = var.db_username
  password                   = var.db_password
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.rds.id]
  publicly_accessible        = false
  multi_az                   = false
  backup_retention_period    = 1
  auto_minor_version_upgrade = true
  deletion_protection        = false
  skip_final_snapshot        = true
  apply_immediately          = true
  tags                       = { Name = "my-music-db" }
}
