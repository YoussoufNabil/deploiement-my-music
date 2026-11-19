resource "aws_iam_role" "ec2" {
  name = "my-music-ec2-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "sts:AssumeRole"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy" "app_access" {
  name = "my-music-app-access"
  role = aws_iam_role.ec2.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "BucketListing"
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.uploads.arn]
      },
      {
        Sid    = "AudioObjectAccess"
        Effect = "Allow"
        Action = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
        Resource = ["${aws_s3_bucket.uploads.arn}/*"]
      },
      {
        Sid    = "ReadDatabaseAndJwtSecrets"
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = [aws_ssm_parameter.app_db_password.arn, aws_ssm_parameter.jwt_secret.arn]
      },
      {
        Sid    = "EcrPull"
        Effect = "Allow"
        Action = ["ecr:GetAuthorizationToken"]
        Resource = ["*"]
      },
      {
        Sid    = "EcrRepositoryPull"
        Effect = "Allow"
        Action = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]
        Resource = [aws_ecr_repository.app.arn]
      },
      {
        Sid    = "ApplicationCloudWatchLogs"
        Effect = "Allow"
        Action = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = ["${aws_cloudwatch_log_group.app.arn}:*"]
      }
    ]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "my-music-ec2-profile"
  role = aws_iam_role.ec2.name
}
