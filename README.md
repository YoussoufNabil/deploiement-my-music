# My Music — application de streaming conteneurisée sur AWS

> Reconstruction du projet à partir du rapport « Déploiement d’une application web conteneurisée sur AWS » (37 pages). Le rapport décrit l'architecture, le déploiement et les noms des six tables, mais ne contient pas le code source complet de `server.js`, `schema.sql` ni les fichiers front-end. Cette arborescence fournit donc une implémentation reconstruite, cohérente avec les fonctions et composants documentés ; elle ne prétend pas être la récupération exacte des fichiers perdus.

## 1. Fonctionnalités reconstruites

- Interface web « My Music » avec recherche, catalogue et lecteur audio.
- API Node.js / Express : authentification, catalogue musical, lecture/téléchargement, likes, profils, partages et actualités.
- Upload de fichiers audio et de pochettes : stockage local en développement ou Amazon S3 en environnement AWS.
- Base MySQL avec six tables: `users`, `musiques`, `likes`, `nb_telechargements`, `news` et `partages`.
- Image Docker basée sur Node.js 18 Alpine.
- Infrastructure Terraform : VPC `10.0.0.0/16`, un subnet public, deux subnets privés RDS, une EC2 `t3.micro`, RDS MySQL mono-AZ `db.t3.micro`, S3 privé chiffré, ECR, IAM et SSM Parameter Store.
- Déploiement EC2 administré par AWS Systems Manager Session Manager ; aucune clé SSH EC2 n'est nécessaire.
- Workflow GitHub Actions facultatif pour construire/publier l'image ECR et déclencher le redéploiement via SSM.

## 2. Arborescence

```text
my-music-aws/
├── .github/workflows/deploy.yml
├── database/schema.sql
├── docs/
│   ├── architecture.md
│   └── deployment-aws.md
├── infra/terraform/
│   ├── provider.tf
│   ├── variables.tf
│   ├── vpc.tf
│   ├── security.tf
│   ├── rds.tf
│   ├── s3.tf
│   ├── iam.tf
│   ├── ssm.tf
│   ├── ecr.tf
│   ├── ec2.tf
│   ├── outputs.tf
│   └── terraform.tfvars.example
├── public/{css,js}/
├── scripts/deploy-on-ec2.sh
├── src/{config,middleware,routes,services}/
├── .dockerignore
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## 3. Lancer en local avec Docker Compose

Prérequis : Docker Desktop et Docker Compose.

```powershell
# À la racine du projet
Copy-Item .env.example .env
```

Modifie `.env` : définis au minimum `JWT_SECRET` avec une valeur longue et aléatoire. Ne publie jamais ce fichier.

```powershell
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Ouvre ensuite `http://localhost:3000`. L'API de santé est disponible sur `http://localhost:3000/health` et le catalogue sur `http://localhost:3000/api/musiques`.

Pour arrêter :

```powershell
docker compose down
```

Pour supprimer également le volume MySQL local (opération destructive) :

```powershell
docker compose down -v
```

## 4. Créer le premier compte

Depuis l'interface, ouvre **Connexion**, puis **Créer un compte**. L'API enregistre le mot de passe sous forme de hash bcrypt ; le mot de passe en clair n'est jamais stocké.

L'upload est accessible après connexion. En local, les fichiers sont déposés dans `storage/uploads/`. Sur AWS, ils sont envoyés dans le bucket S3 privé et servis via des URL pré-signées de durée limitée.

## 5. Déployer l'infrastructure AWS avec Terraform

> Attention aux coûts : EC2, RDS, EBS, IPv4 publique/EIP, S3 et ECR peuvent être facturés. Le type `t3.micro` et l'architecture mono-AZ ne garantissent pas l'éligibilité aux offres gratuites dans toutes les régions/comptes. Vérifie les tarifs AWS avant `terraform apply`.

1. Utilise un profil AWS IAM/SSO dédié avec les permissions nécessaires. Ne pas utilise les clés du compte root.
2. Configure AWS CLI sur le poste :

   ```powershell
   aws configure
   aws sts get-caller-identity
   ```

3. Prépare les variables Terraform :

   ```powershell
   cd infra/terraform
   Copy-Item terraform.tfvars.example terraform.tfvars
   ```

   Modifie `terraform.tfvars` et définis `db_password` (administrateur RDS) et `app_db_password` (utilisateur applicatif `app_user`) avec deux secrets forts et différents. Le fichier `terraform.tfvars` est ignoré par Git.
4. Initialise et vérifie :

   ```powershell
   terraform fmt -recursive
   terraform init
   terraform validate
   terraform plan -out=tfplan
   ```
5. Examine le plan et seulement ensuite applique :

   ```powershell
   terraform apply tfplan
   ```
6. Note les sorties :

   ```powershell
   terraform output
   ```

Terraform crée une EC2 publique et une RDS privée. L'accès SSH est limité au CIDR `my_ip` (par défaut `127.0.0.1/32`), tandis que l'administration recommandée se fait avec SSM. Le port 3000 est ouvert selon le CIDR configuré dans `app_allowed_cidr` pour reproduire le test HTTP du rapport. Pour un service réellement exposé, restreins ce port et place Nginx + HTTPS devant l'application.

### État Terraform

Ne pousse jamais `.terraform/`, `terraform.tfstate*`, `tfplan` ou `terraform.tfvars`. L'état Terraform contient des identifiants d'infrastructure et peut contenir des valeurs sensibles. Pour une équipe ou une utilisation durable, configure un backend distant chiffré avec verrouillage.

## 6. Initialiser la base RDS

La RDS du projet est dans des subnets privés : ton PC ne peut pas la joindre directement depuis Internet. Deux options :

- ouvrir un tunnel SSM de port forwarding via l'instance EC2, puis exécuter `database/schema.sql` depuis ton PC ;
- ou transférer/importer le fichier SQL depuis une session EC2 disposant d'un accès réseau à RDS.

Exemple de tunnel (remplace les valeurs par les sorties de Terraform) :

```powershell
aws ssm start-session `
  --target i-xxxxxxxxxxxxxxxxx `
  --document-name AWS-StartPortForwardingSessionToRemoteHost `
  --parameters '{"host":["TON_ENDPOINT_RDS"],"portNumber":["3306"],"localPortNumber":["13306"]}' `
  --region us-east-1
```

Dans un autre terminal, si le client MySQL est installé :

```powershell
mysql -h 127.0.0.1 -P 13306 -u admin -p my_music < database/schema.sql
```

Le mot de passe maître RDS est celui fourni à `db_password`. Après l'import du schéma, exécute aussi `database/create-app-user.sql.example` après avoir remplacé son placeholder par la même valeur que `app_db_password` dans Terraform. L'application utilise `app_user`, pas le compte maître. Ne mets aucun secret dans une commande enregistrée ni dans le dépôt.

## 7. Publier l'image Docker dans ECR et lancer l'application

Les valeurs `ECR_REPOSITORY_URL`, `EC2_INSTANCE_ID`, `DB_HOST`, `S3_BUCKET` et `DB_USER` sont à renseigner à partir de `terraform output` : `DB_HOST` correspond à `rds_hostname` (nom d'hôte seul, sans `:3306`) et `DB_USER` vaut `app_user`.

Depuis ton poste, après `aws sts get-caller-identity` :

```powershell
$Region = "us-east-1"
$EcrUri = (terraform -chdir=infra/terraform output -raw ecr_repository_url)
aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin ($EcrUri -replace '/my-music$','')
docker build -t my-music:latest .
docker tag my-music:latest "$($EcrUri):latest"
docker push "$($EcrUri):latest"
```

Connecte-toi à EC2 avec Session Manager :

```powershell
aws ssm start-session --target ID_INSTANCE --region us-east-1
```

Sur EC2, le script `scripts/deploy-on-ec2.sh` doit être transféré ou recréé sous `/opt/my-music/deploy-on-ec2.sh`. Il utilise le rôle IAM de l'instance pour récupérer le mot de passe de `app_user` et le secret JWT depuis SSM Parameter Store, puis s'authentifier auprès d'ECR. Il ne faut pas configurer de clés AWS statiques sur EC2.

Exemple de lancement manuel (sur EC2, après avoir rendu le script disponible) :

```bash
sudo AWS_REGION=us-east-1 \
  ECR_REGISTRY=TON_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com \
  ECR_REPOSITORY=my-music \
  IMAGE_TAG=latest \
  DB_HOST=TON_ENDPOINT_RDS \
  DB_USER=app_user \
  DB_NAME=my_music \
  S3_BUCKET=TON_BUCKET_S3 \
  bash /opt/my-music/deploy-on-ec2.sh
```

L'application lit le mot de passe de l'utilisateur `app_user` au démarrage via SSM avec son rôle IAM. Le rôle EC2 doit donc avoir `ssm:GetParameter` sur `/my-music/prod/app_db_password` et `/my-music/prod/jwt_secret`.

## 8. GitHub Actions (facultatif)

Le workflow `.github/workflows/deploy.yml` est fourni comme base de CI/CD. Il utilise GitHub OIDC (pas de clé AWS statique stockée dans le dépôt), publie l'image dans ECR et demande à SSM de redéployer EC2.

Configurer dans **Settings → Secrets and variables → Actions** :

- Secret `AWS_GITHUB_ACTIONS_ROLE_ARN` : ARN du rôle assumable par GitHub Actions via OIDC.
- Variables `AWS_REGION`, `ECR_REPOSITORY`, `ECR_REGISTRY`, `EC2_INSTANCE_ID`, `DB_HOST`, `DB_USER`, `DB_NAME`, `S3_BUCKET`.

Le rôle GitHub doit avoir uniquement les droits ECR push et `ssm:SendCommand` sur l'instance visée (et de quoi lire le résultat d'exécution SSM). Sa relation de confiance doit restreindre le sujet OIDC à ton dépôt et à la branche `main`. La création de ce rôle OIDC est une étape IAM à effectuer dans ton compte AWS ; le workflow ne la crée pas automatiquement.

## 9. Tests et vérifications

```powershell
npm install
npm test
```

Les tests inclus vérifient la configuration et les utilitaires sans contacter AWS. Pour tester l'application complète, utilise Docker Compose et vérifie `/health`, l'inscription, la connexion, le catalogue et l'upload.

.
