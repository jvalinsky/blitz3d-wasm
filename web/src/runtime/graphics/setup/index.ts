
import { Blitz3DGraphics } from "../index";

import { setupCore } from "./core";
import { setup2D } from "./2d";
import { setupImage } from "./image";
import { setup3D } from "./3d";
import { setupPicking } from "./picking";
import { setupCollision } from "./collision";
import { setupInput } from "./input";

export function setupAllImports(graphics: Blitz3DGraphics, imports: any) {
    setupCore.call(graphics, imports);
    setupInput.call(graphics, imports); // Initialize input early
    setup2D.call(graphics, imports);
    setupImage.call(graphics, imports);
    setup3D.call(graphics, imports);
    setupPicking.call(graphics, imports);
    setupCollision.call(graphics, imports);
}
