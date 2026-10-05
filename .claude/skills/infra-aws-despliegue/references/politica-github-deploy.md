# Política gestionada `github-deploy-terraform`

Cuenta `664342886904`, región `eu-north-1`. Es la versión vigente; si se añaden recursos, edita este fichero y súbela con `create-policy-version --set-as-default` (máximo 5 versiones: borra las antiguas si da `LimitExceeded`).

En PowerShell se guarda así y se sube a IAM:

```powershell
@'
{ ...JSON de abajo... }
'@ | Set-Content -Encoding ascii $env:TEMP\github-deploy-managed.json

aws iam create-policy-version --policy-arn arn:aws:iam::664342886904:policy/github-deploy-terraform --policy-document file://$env:TEMP\github-deploy-managed.json --set-as-default
```

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::tfstate-664342886904-eu-north-1"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::tfstate-664342886904-eu-north-1/*"
    },
    {
      "Effect": "Allow",
      "Action": "dynamodb:*",
      "Resource": [
        "arn:aws:dynamodb:eu-north-1:664342886904:table/usuarios",
        "arn:aws:dynamodb:eu-north-1:664342886904:table/usuarios/index/*",
        "arn:aws:dynamodb:eu-north-1:664342886904:table/plantillas",
        "arn:aws:dynamodb:eu-north-1:664342886904:table/plantillas/index/*",
        "arn:aws:dynamodb:eu-north-1:664342886904:table/documentos",
        "arn:aws:dynamodb:eu-north-1:664342886904:table/documentos/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::plantillas-664342886904-eu-north-1",
        "arn:aws:s3:::plantillas-664342886904-eu-north-1/*",
        "arn:aws:s3:::documentos-664342886904-eu-north-1",
        "arn:aws:s3:::documentos-664342886904-eu-north-1/*",
        "arn:aws:s3:::web-664342886904-eu-north-1",
        "arn:aws:s3:::web-664342886904-eu-north-1/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "cloudfront:*",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": "cognito-idp:*",
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "iam:CreateRole", "iam:GetRole", "iam:DeleteRole", "iam:TagRole", "iam:UntagRole",
        "iam:UpdateAssumeRolePolicy", "iam:AttachRolePolicy", "iam:DetachRolePolicy",
        "iam:ListAttachedRolePolicies", "iam:ListRolePolicies", "iam:GetRolePolicy",
        "iam:PutRolePolicy", "iam:DeleteRolePolicy", "iam:ListInstanceProfilesForRole", "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::664342886904:role/usuarios-lambda-rol",
        "arn:aws:iam::664342886904:role/plantillas-lambda-rol",
        "arn:aws:iam::664342886904:role/documentos-lambda-rol"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "lambda:*",
      "Resource": [
        "arn:aws:lambda:eu-north-1:664342886904:function:usuarios-api",
        "arn:aws:lambda:eu-north-1:664342886904:function:plantillas-api",
        "arn:aws:lambda:eu-north-1:664342886904:function:documentos-api"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "apigateway:*",
      "Resource": "arn:aws:apigateway:eu-north-1::/*"
    }
  ]
}
```
