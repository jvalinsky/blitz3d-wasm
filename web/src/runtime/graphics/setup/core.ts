import { Blitz3DGraphics } from "../index";
import * as THREE from "three";

export function setupCore(this: Blitz3DGraphics, imports: any) {
    imports.env.Graphics3D = (width: number, height: number, depth: number, mode: number) => {
        console.log(
            "Graphics3D called: " + width + "x" + height + ", depth=" + depth +
            ", mode=" + mode,
        );

        // Validate dimensions
        if (width <= 0 || height <= 0) {
            console.error(
                "Graphics3D: Invalid dimensions " + width + "x" + height +
                ", using defaults",
            );
            width = 800;
            height = 600;
        }

        if (width > 4096 || height > 4096) {
            console.warn("Graphics3D: dimensions exceed maximum, capping to 4096");
            width = Math.min(width, 4096);
            height = Math.min(height, 4096);
        }

        if (this.core.canvas) {
            console.log(
                "Updating canvas from " + this.core.canvas.width + "x" +
                this.core.canvas.height + " to " + width + "x" + height,
            );
            this.core.canvas.width = width;
            this.core.canvas.height = height;
        } else {
            console.error("Graphics3D: canvas is not available!");
        }

        if (this.renderer) {
            console.log("Setting renderer size to " + width + "x" + height);
            this.renderer.setSize(width, height);

            // Important: Update camera aspect ratio
            if (this.camera) {
                if (this.camera instanceof (window as any).THREE.PerspectiveCamera) {
                    const cam = this.camera as THREE.PerspectiveCamera;
                    console.log(
                        "Updating camera aspect from " + cam.aspect + " to " +
                        (width / height),
                    );
                    cam.aspect = width / height;
                    cam.updateProjectionMatrix();
                    console.log("Camera projection updated");
                }
            } else {
                console.warn("Graphics3D: No camera to update aspect ratio");
            }
        } else {
            console.error("Graphics3D: renderer is not initialized!");
        }

        console.log("Graphics3D initialization complete");
    };

    imports.env.GraphicsWidth = () =>
        this.core.canvas ? this.core.canvas.width : 800;
    imports.env.GraphicsHeight = () =>
        this.core.canvas ? this.core.canvas.height : 600;
    imports.env.WindowWidth = () => window.innerWidth;
    imports.env.WindowHeight = () => window.innerHeight;
    imports.env.VWait = (n: number) => { }; // No-op
}
