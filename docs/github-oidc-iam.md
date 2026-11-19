# GitHub Actions — configuration OIDC côté AWS

Le workflow n'utilise pas d'Access Key AWS persistante. Il faut créer une fois un fournisseur OIDC GitHub dans IAM (`https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`) et un rôle IAM de déploiement. Restreins toujours la relation de confiance à ton dépôt et à la branche `main` :

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:OWNER/REPOSITORY:ref:refs/heads/main"
      }
    }
  }]
}
```

Exemple de permissions à adapter à la région, au compte, au dépôt ECR et à l'instance EC2 :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "EcrPush",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:CompleteLayerUpload",
        "ecr:InitiateLayerUpload",
        "ecr:PutImage",
        "ecr:UploadLayerPart"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EcrRepository",
      "Effect": "Allow",
      "Action": ["ecr:BatchCheckLayerAvailability", "ecr:CompleteLayerUpload", "ecr:InitiateLayerUpload", "ecr:PutImage", "ecr:UploadLayerPart"],
      "Resource": "arn:aws:ecr:REGION:ACCOUNT_ID:repository/my-music"
    },
    {
      "Sid": "SendDeployCommand",
      "Effect": "Allow",
      "Action": ["ssm:SendCommand"],
      "Resource": [
        "arn:aws:ssm:REGION::document/AWS-RunShellScript",
        "arn:aws:ec2:REGION:ACCOUNT_ID:instance/INSTANCE_ID"
      ]
    },
    {
      "Sid": "ReadDeployCommand",
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ssm:ListCommands"],
      "Resource": "*"
    }
  ]
}
```

Dans GitHub, créer le secret `AWS_GITHUB_ACTIONS_ROLE_ARN` et les variables mentionnées dans le README. Le `sub` OIDC doit correspondre exactement au propriétaire, au nom du dépôt et à la branche utilisée.
