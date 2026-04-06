// =============================================================================
// CC License Picker Component — Phase 2 placeholder
// =============================================================================
//
// Shared component for selecting a Creative Commons license at the point of
// content creation/publication. Used in:
//   - Article editor (app/a/new/)
//   - Social post composer (components/social/PostComposer.tsx)
//   - Event photo upload flow
//   - Profile image upload
//
// Design requirements:
//   - Two options: CC BY 4.0 and CC BY-SA 4.0 (default)
//   - Visual CC badge for each option linking to the license deed
//   - Brief plain-language explanation of what each license allows
//   - Selection persisted with the content record (cc_license column)
//   - Value type: 'cc-by-4' | 'cc-by-sa-4'
//
// Integration points:
//   - Upload API rejects submissions without a license selection
//   - ActivityPub objects include cc:license property
//   - Article and post pages render a visible CC badge
//   - Machine-readable license metadata embedded (JSON-LD, OpenGraph)
//
// Database:
//   - Requires cc_license column on articles, social statuses, event photos,
//     and any other user-content tables (Phase 4)
//   - Schema: text column, enum values 'cc-by-4' | 'cc-by-sa-4'
//
// Props interface (planned):
//   interface CCLicensePickerProps {
//     value: 'cc-by-4' | 'cc-by-sa-4';
//     onChange: (license: 'cc-by-4' | 'cc-by-sa-4') => void;
//     compact?: boolean;   // inline badge-only mode for tight layouts
//     disabled?: boolean;
//   }
//
// CC badge assets:
//   - Store in public/legal/cc-badges/ or use CC CDN URLs
//   - CC BY 4.0:    https://licensebuttons.net/l/by/4.0/88x31.png
//   - CC BY-SA 4.0: https://licensebuttons.net/l/by-sa/4.0/88x31.png
//   - License deeds:
//     - https://creativecommons.org/licenses/by/4.0/
//     - https://creativecommons.org/licenses/by-sa/4.0/
//
// Archive threshold notice (shown alongside picker for applicable content):
//   "This content is licensed under [selected license]. After [threshold],
//    it becomes part of the community record and cannot be fully deleted.
//    You may still request anonymization of your name."
//
// Social timeline variant (no archive threshold):
//   "This content is licensed under [selected license]. It can be deleted
//    at any time. Federated copies on other servers may persist."
//
// =============================================================================
