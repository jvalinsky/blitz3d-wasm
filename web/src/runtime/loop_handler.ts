export class BlitzLoopHandler {
  constructor(private context: any) {}

  registerImports(imports: any) {
    if (!imports.blitz3d) imports.blitz3d = {};
    if (!imports.env) imports.env = {};

    imports.blitz3d.WaitKey = () => 0;
    imports.blitz3d.GetKey = () => 0;
  }
}
