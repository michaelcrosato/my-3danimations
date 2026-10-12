// B1's known-good sheet: the three clips' contact sheets, one under another, as sheet.png.
import { openLibrary } from "@m3a/library/node";
import { raster, sheet } from "@m3a/sensors";
import { writePng } from "@m3a/sensors/node";

const library = openLibrary();
const sheets = ["QUATERNIUS_3D2DGE/Idle_Loop", "QUATERNIUS_3D2DGE/Walk_Loop", "QUATERNIUS_3D2DGE/Jog_Fwd_Loop"].map((id) => {
  const { clip, rest } = library.clip(id);
  return sheet(clip, rest, { frames: 8 }).image;
});
writePng("sheet.png", raster.join(sheets, { down: true }));
