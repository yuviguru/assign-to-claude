# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Use GitHub's private vulnerability reporting instead:
1. Go to the **Security** tab of this repository
2. Click **Report a vulnerability**
3. Fill in the details

Alternatively, email **yuvaraj@keenandken.com** with:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (optional)

You can expect an acknowledgement within **48 hours** and a fix or mitigation plan within **7 days** for critical issues.

## Scope

This project is a CLI tool and GitHub Actions workflow generator. Security concerns include:
- Secrets or tokens being exposed in generated files
- Unsafe shell commands in generated workflows
- Webhook handler vulnerabilities in generated server code

## Out of Scope

- Vulnerabilities in the user's own PM tool or GitHub Actions environment
- Issues in third-party dependencies (please report those upstream)
