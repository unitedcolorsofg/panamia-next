# Config Directory

Configuration files for external services and integrations.

## Files

_(No service config files remain — email is handled via CF Email Sending binding in `lib/email.ts`)_

## Usage

Import configuration where needed:

```typescript
import { sendEmail } from '@/lib/email';
```

## Adding Configurations

When adding new service integrations:

1. Create a config file here
2. Use environment variables for sensitive values
3. Export typed configuration objects
4. Document required env vars in `.env.local.example`
