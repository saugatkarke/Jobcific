# Website Logo Replacement Design

## Goal

Use the new `public/Jobcific-logo.svg` asset for every visible website logo.

## Scope

1. Update the shared `src/components/Logo.tsx` component to render `/Jobcific-logo.svg`.
2. Set the image's intrinsic dimensions to the new square asset dimensions.
3. Preserve the existing component API, styling hooks, priority behavior, and accessible alt text.
4. Allow the shared component to update both the site header and site footer.

## Exclusions

1. Do not change the browser favicon.
2. Do not change logos used by authentication emails.
3. Do not delete or overwrite existing logo assets.

## Verification

1. Run the relevant automated checks.
2. Confirm the header and footer both resolve the new SVG through the shared component.
3. Check that the square logo fits within the existing header and footer layouts.
