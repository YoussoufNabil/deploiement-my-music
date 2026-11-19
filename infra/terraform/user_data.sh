#!/bin/bash
set -euxo pipefail

dnf update -y
dnf install -y docker amazon-ssm-agent
systemctl enable --now docker
systemctl enable --now amazon-ssm-agent
usermod -aG docker ec2-user || true
mkdir -p /opt/my-music
chown ec2-user:ec2-user /opt/my-music
