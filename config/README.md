# Config Directory

Configuration files for external services and integrations.

## Files

### `brevo.ts`

Brevo (formerly Sendinblue) email service configuration:

- API client setup
- Email template IDs
- Sender configuration

## Usage

Import configuration where needed:

```typescript
import { brevoConfig } from '@/config/brevo';
```

## Adding Configurations

When adding new service integrations:

1. Create a config file here
2. Use environment variables for sensitive values
3. Export typed configuration objects
4. Document required env vars in `.env.local.example`
