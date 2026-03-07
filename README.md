# Knotes API & Cloud infrastructure

## AWS Account Bootstrap

Before deploying application stacks, bootstrap the account once:

```bash
aws login
cd infrastructure
npx cdk deploy KnotesApiAccount
```
