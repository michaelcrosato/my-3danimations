// The software raster (PLAN.md WP-3.1): images, a bitmap font, orthographic views, the capsule mannequin, PNG bytes.
export { image, fill, pixel, rect, line, blit, join, coverage, assertNotBlank, BACKGROUND, type Image, type Rgb } from "./image.ts";
export { text, textWidth, GLYPH } from "./font.ts";
export { VIEWS, viewOf, camera, plane, project, fit, type View, type ViewName, type Camera } from "./view.ts";
export { capsules, drawCapsules, drawFloor, render, turntable, labelScale, COLORS, type Capsule, type Root, type RenderOptions } from "./mannequin.ts";
export { encodePng, crc32, type Deflate } from "./png.ts";
