# Security Policy

## Reporting Security Vulnerabilities

We take security seriously. If you discover a security vulnerability in WaspBot, please help us by reporting it responsibly.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing us at [security@waspbot.xyz](mailto:security@waspbot.xyz) or by using GitHub's [Security Advisories](https://github.com/WaspBot/waspbot-ts/security/advisories) feature.

When reporting a vulnerability, please include:

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Any suggested fixes or mitigations

We will acknowledge your report within 48 hours and provide a more detailed response within 7 days indicating our next steps. We will keep you informed about our progress throughout the process of fixing the vulnerability.

## Supported Versions

We actively support the following versions with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

Versions that are no longer supported may still receive critical security updates at our discretion.

## Security Best Practices

As a trading bot framework, WaspBot handles sensitive financial data and API credentials. Here are some security best practices to follow when using WaspBot:

### API Key Management

- **Never hardcode API keys** in your source code. Use environment variables or secure credential management systems.
- **Use read-only API keys** when possible for market data access.
- **Rotate API keys regularly** and immediately if you suspect compromise.
- **Use testnet environments** for development and testing to avoid real financial losses.

### Environment Security

- Run WaspBot in isolated environments (containers, VMs) with minimal privileges.
- Keep your Node.js runtime and dependencies up to date.
- Use firewalls and network security measures to protect your trading infrastructure.
- Monitor for unusual activity in your trading accounts.

### Code Security

- Regularly update WaspBot and its dependencies to the latest versions.
- Audit your custom strategies and connectors for security issues.
- Use TypeScript's type safety features to prevent common vulnerabilities.
- Implement proper error handling to avoid exposing sensitive information in logs.

### Financial Risk Management

- Start with small position sizes when testing new strategies.
- Implement stop-loss mechanisms in your trading logic.
- Monitor your bot's performance and intervene manually if needed.
- Be aware that algorithmic trading carries inherent financial risks.

## Responsible Disclosure

We kindly ask that you:

- Give us reasonable time to fix the issue before public disclosure.
- Avoid accessing or modifying user data without permission.
- Do not perform denial-of-service attacks or degrade services.

We appreciate your help in keeping WaspBot and its users secure!

## Contact

For security-related questions or concerns, please contact us at [security@waspbot.xyz](mailto:security@waspbot.xyz).