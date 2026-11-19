# Procédure de déploiement AWS

## 1. Prérequis

- Compte AWS et profil CLI configuré dans la région `us-east-1`.
- Terraform >= 1.5, AWS CLI v2, Docker.
- Permissions IAM suffisantes pour créer VPC, EC2, EIP, RDS, S3, ECR, IAM et SSM.

## 2. Déployer l'infrastructure

Suivre `infra/terraform/README.md`. Vérifier le plan avant application. La première création peut prendre plusieurs minutes, notamment pour RDS.

## 3. Initialiser MySQL

RDS est privée ; utiliser un tunnel SSM `AWS-StartPortForwardingSessionToRemoteHost` vers l'endpoint RDS et exécuter `database/schema.sql` sur `127.0.0.1:13306` avec le compte maître. Créer ensuite l'utilisateur applicatif avec `database/create-app-user.sql.example` (mot de passe identique à `app_db_password` dans Terraform).

## 4. Construire et pousser l'image ECR

```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
docker build -t my-music:latest .
docker tag my-music:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/my-music:latest
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/my-music:latest
```

## 5. Déployer sur EC2

Se connecter avec Session Manager. Installer Docker si nécessaire (le `user_data.sh` de Terraform s'en charge), placer `scripts/deploy-on-ec2.sh` dans `/opt/my-music/`, puis l'exécuter avec les variables listées dans le README principal. L'instance récupère les secrets SSM via son rôle IAM.

## 6. Vérifier

```bash
docker ps
docker logs --tail=100 my-music
curl -i http://localhost:3000/health
curl -i http://localhost:3000/api/musiques
```

Depuis le poste client, tester `http://EC2_PUBLIC_IP:3000`. Cette vérification HTTP correspond à la fin du rapport, mais ne doit pas être considérée comme une configuration de production sécurisée. Ajouter Nginx et TLS avant une exposition réelle.
