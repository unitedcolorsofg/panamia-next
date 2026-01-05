# DB Directory

MongoDB queries and database utilities.

## Files

### `profiles_by_recent.mongodb.js`

MongoDB shell script for querying profiles by recent activity.
Can be run in MongoDB Compass or mongosh.

## Usage

These files are typically used for:

- Ad-hoc database queries
- Data exploration
- Migration scripts
- Debugging

Run in MongoDB shell:

```bash
mongosh "mongodb+srv://..." --file db/profiles_by_recent.mongodb.js
```

Or paste into MongoDB Compass query interface.

## Notes

- These are NOT used by the application at runtime
- For application database logic, see `/lib/model/`
- Keep sensitive queries local (don't commit credentials)
