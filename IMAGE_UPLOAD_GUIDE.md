# Image Upload System - Usage Guide

## Overview

The Revel Frontend now includes a comprehensive image upload system with **automatic cropping** and **dimension enforcement** to ensure optimal social media previews across WhatsApp, Facebook, Twitter, LinkedIn, and other platforms.

## Key Features

✅ **Automatic Image Cropping** - Interactive cropper with zoom and pan
✅ **Aspect Ratio Enforcement** - Square (1:1) for logos, Landscape (1.91:1) for cover art
✅ **Dimension Requirements** - Enforces minimum and recommended sizes
✅ **Social Media Optimization** - 1200x630px for perfect link previews
✅ **User Guidance** - Clear visual feedback and helpful instructions
✅ **Mobile Friendly** - Touch gestures, pinch to zoom
✅ **Accessibility** - Full keyboard navigation and ARIA labels

## Components

### 1. ImageUploader (Enhanced)
**Location:** `src/lib/components/forms/ImageUploader.svelte`

The main upload component with integrated cropping functionality.

### 2. ImageCropper (New)
**Location:** `src/lib/components/forms/ImageCropper.svelte`

Interactive cropper modal that appears when a user selects an image.

### 3. Image Validation Utilities (New)
**Location:** `src/lib/utils/image-validation.ts`

Dimension checking, aspect ratio validation, and requirements definitions.

## Usage Examples

### For Event Cover Art (Landscape 1.91:1)

```svelte
<script lang="ts">
  let coverArtFile = $state<File | null>(null);
</script>

<ImageUploader
  bind:value={coverArtFile}
  label="Event Cover Art"
  imageType="coverArt"
  aspectRatio="wide"
  enableCropping={true}
  maxSize={5 * 1024 * 1024}
  required
/>
```

**Output:** 1200x630px PNG, perfect for social media link previews

### For Event/Organization Logo (Square 1:1)

```svelte
<script lang="ts">
  let logoFile = $state<File | null>(null);
</script>

<ImageUploader
  bind:value={logoFile}
  label="Organization Logo"
  imageType="logo"
  aspectRatio="square"
  enableCropping={true}
  maxSize={5 * 1024 * 1024}
  required
/>
```

**Output:** 1024x1024px PNG, ideal for profile pictures and icons

### Disable Cropping (Legacy Behavior)

```svelte
<ImageUploader
  bind:value={imageFile}
  label="Event Banner"
  enableCropping={false}
  aspectRatio="wide"
/>
```

## Image Requirements

### Cover Art (Landscape)
- **Recommended:** 1200x630px (1.91:1 aspect ratio)
- **Minimum:** 800x420px
- **Tolerance:** ±15% aspect ratio
- **Purpose:** Social media link previews (WhatsApp, Facebook, Twitter, LinkedIn)

### Logo (Square)
- **Recommended:** 1024x1024px (1:1 aspect ratio)
- **Minimum:** 400x400px
- **Tolerance:** ±5% aspect ratio
- **Purpose:** Profile pictures, icons, circular avatars

## Cropper Features

### User Controls
- **Drag:** Reposition the crop area
- **Scroll/Pinch:** Zoom in/out
- **Reset Button:** Reset to center position
- **Zoom Slider:** Fine-tune zoom level (1x - 3x)
- **Apply Crop:** Process and upload the cropped image
- **Cancel:** Discard and start over

### Visual Feedback
- Real-time preview of crop area
- Target dimensions displayed (e.g., "1200x630px")
- Aspect ratio info (e.g., "1.91:1 Social Media")
- Helpful tips and guidance messages
- Dark mode support

### Technical Details
- Uses `svelte-easy-crop` library
- Outputs PNG format (lossless quality)
- Client-side processing (no server upload until finalized)
- CORS-safe with cross-origin image handling
- Touch and mouse gesture support

## Migration Guide

### For Existing Components

#### Before (Old ImageUploader):
```svelte
<ImageUploader
  bind:value={eventCoverArt}
  label="Event Banner"
  aspectRatio="wide"
/>
```

#### After (With Cropping):
```svelte
<ImageUploader
  bind:value={eventCoverArt}
  label="Event Cover Art"
  imageType="coverArt"
  aspectRatio="wide"
  enableCropping={true}
/>
```

**Key Changes:**
1. Add `imageType="coverArt"` or `imageType="logo"`
2. Set `enableCropping={true}` (default)
3. Aspect ratio is now enforced automatically

### Update All Upload Forms

Search for existing `ImageUploader` usages:
```bash
grep -r "ImageUploader" src/routes/ src/lib/components/
```

Update each instance with the appropriate `imageType`:
- **Event cover art** → `imageType="coverArt"`
- **Event logo** → `imageType="logo"`
- **Organization cover art** → `imageType="coverArt"`
- **Organization logo** → `imageType="logo"`
- **Event Series cover art** → `imageType="coverArt"`
- **Event Series logo** → `imageType="logo"`

## SEO Impact

### Before This Update
- ❌ Square logos (1024x1024) used for link previews
- ❌ WhatsApp/Facebook cropped or ignored images
- ❌ No aspect ratio enforcement
- ❌ Event description shown in previews

### After This Update
- ✅ Landscape cover art (1200x630) prioritized
- ✅ Perfect display in WhatsApp/Facebook/Twitter
- ✅ Automatic aspect ratio enforcement
- ✅ City and date shown in link previews
- ✅ Professional, consistent appearance

### Link Preview Example

**Before:**
```
Title: Spring Community Potluck & Garden Party
Description: # Spring Community Potluck & Garden Party 🌸 Celebrate the...
Image: [Square logo, 1024x1024, cropped awkwardly]
```

**After:**
```
Title: Spring Community Potluck & Garden Party
Description: Fri, Nov 15 • 5:00 PM - 11:00 PM • Vienna, Austria
Image: [Landscape cover art, 1200x630, perfect fit]
```

## Testing Checklist

### Desktop Testing
- [ ] Upload and crop an image for event cover art
- [ ] Upload and crop an image for event logo
- [ ] Test zoom slider (1x - 3x)
- [ ] Test reset button
- [ ] Test cancel button
- [ ] Verify cropped image dimensions
- [ ] Test dark mode appearance

### Mobile Testing
- [ ] Touch drag to reposition
- [ ] Pinch to zoom
- [ ] Tap controls work correctly
- [ ] Upload from camera
- [ ] Upload from gallery
- [ ] Cropper UI fits on small screens

### Accessibility Testing
- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader announces controls
- [ ] ARIA labels are correct
- [ ] Error messages are accessible

### Edge Cases
- [ ] Very small images (below minimum)
- [ ] Very large images (above max size)
- [ ] Wrong aspect ratio images
- [ ] Non-image files
- [ ] Corrupted images

## Common Issues

### Issue: Cropper doesn't appear
**Solution:** Ensure `imageType` prop is set (`"logo"` or `"coverArt"`)

### Issue: Image quality is poor
**Solution:** The cropper outputs PNG at full quality. Check source image quality.

### Issue: Wrong aspect ratio error
**Solution:** The cropper enforces aspect ratios automatically. This shouldn't occur unless cropping is disabled.

### Issue: Upload fails after cropping
**Solution:** Check backend file size limits and CORS configuration.

## Backend Considerations

### Media Upload Endpoints
Ensure backend endpoints accept PNG format:
- `/api/events/{id}/upload-logo/`
- `/api/events/{id}/upload-cover-art/`
- `/api/organizations/{id}/upload-logo/`
- `/api/organizations/{id}/upload-cover-art/`

### File Size Limits
Cropped images are typically 100-500KB (PNG). Ensure backend accepts:
- Minimum: 1MB
- Recommended: 5MB
- Maximum: 10MB

### Image Processing
Backend should:
1. Accept cropped images as-is (already correctly sized)
2. Optionally convert PNG → WebP for storage
3. Serve images with proper CORS headers
4. Set cache headers (`max-age=86400`)

## Future Enhancements

- [ ] WebP output format (smaller file sizes)
- [ ] Multiple aspect ratio presets
- [ ] Batch image processing
- [ ] Image filters and effects
- [ ] Advanced cropping (freeform, circular)
- [ ] Image compression quality settings
- [ ] Upload progress indicator
- [ ] Retry logic for failed uploads

## Related Files

- `src/lib/utils/seo.ts` - Updated image priority hierarchy
- `src/lib/utils/image-validation.ts` - Dimension validation logic
- `src/lib/components/forms/ImageUploader.svelte` - Main upload component
- `src/lib/components/forms/ImageCropper.svelte` - Cropper modal
- `package.json` - Added `svelte-easy-crop` dependency

## Questions?

For issues or questions about the image upload system:
1. Check this guide first
2. Review component prop documentation
3. Test in browser DevTools
4. Check browser console for errors
5. Open a GitHub issue if needed
