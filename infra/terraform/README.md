# Terraform — My Music AWS V1

Cette configuration suit le schéma du rapport : VPC `10.0.0.0/16`, subnet public EC2, deux subnets privés pour le groupe de subnets RDS, MySQL mono-AZ, bucket S3 privé, ECR, IAM, SSM Parameter Store, une EC2 `t3.micro` et une Elastic IP.

```powershell
Copy-Item terraform.tfvars.example terraform.tfvars
# Modifier terraform.tfvars, en particulier db_password et my_ip
terraform fmt -recursive
terraform init
terraform validate
terraform plan -out=tfplan
terraform apply tfplan
```

Le mot de passe DB est déclaré `sensitive` mais il figure tout de même dans l'état Terraform et dans la configuration de création du paramètre SSM. Protéger l'état et utiliser un backend distant chiffré. Ne commite jamais `terraform.tfvars`, `.terraform/`, `tfplan` ou le state.

La configuration ouvre le port applicatif TCP 3000 selon `app_allowed_cidr` afin de reproduire le test de l'étude. Restreindre le CIDR ou remplacer l'exposition directe par Nginx + HTTPS avant toute utilisation publique durable.
