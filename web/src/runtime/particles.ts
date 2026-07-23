export class BlitzParticles {
  private scene: any;
  private core: any;

  constructor(core: any) {
    this.core = core;
  }

  setScene(scene: any) {
    this.scene = scene;
  }

  registerImports(imports: any) {
    if (!imports.blitz3d) imports.blitz3d = {};
    if (!imports.env) imports.env = {};

    imports.blitz3d.ParticlePiv = () => 0;
    imports.env.ParticleTextures = () => 0;
  }
}
