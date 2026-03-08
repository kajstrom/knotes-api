# Knotes API & Cloud infrastructure

Shamelessly vibe-coded backend for a simple note application.

## AWS Account Bootstrap

Before deploying application stacks, bootstrap the account once:

```bash
aws login
cd infrastructure
npx cdk deploy KnotesApiAccount
```
