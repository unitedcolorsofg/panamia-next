# Scripts Directory

Utility scripts for development, maintenance, and data operations.

## Available Scripts

### `create-signin-link.js`

Generate magic sign-in links for testing:

```bash
node scripts/create-signin-link.js user@example.com
```

### `get-signin-link.js`

Retrieve existing sign-in tokens from the database.

### `migrate-bunnycdn-to-vercel-blob.cjs`

Migration script for moving profile images from BunnyCDN to Vercel Blob:

- Downloads existing images
- Uploads to Vercel Blob
- Updates database references

## Running Scripts

Most scripts can be run with Node.js directly:

```bash
node scripts/script-name.js [args]
```

For CommonJS scripts (`.cjs`), ensure you have the required
environment variables set or use dotenv.

## Adding New Scripts

1. Create script in this directory
2. Use `.js` for ES modules, `.cjs` for CommonJS
3. Add documentation here
4. Consider adding npm script alias in `package.json`

## Environment Variables

Scripts typically need access to:

- `MONGODB_URI` - Database connection
- `BLOB_READ_WRITE_TOKEN` - Vercel Blob access
- Other service-specific credentials

Load from `.env.local` or set in shell environment.
