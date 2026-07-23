export function registerWin32Stubs(imports: any, context: { canvas?: HTMLCanvasElement | null, readString: (ptr: number) => string }) {
  if (!imports.blitz3d) imports.blitz3d = {};
  if (!imports.env) imports.env = {};

  imports.blitz3d.API_GetFocus = () => {
    return typeof document !== "undefined" && document.hasFocus() ? 1 : 0;
  };

  imports.blitz3d.API_GetModuleFilename = (mod: number) => {
    return 0; 
  };

  imports.blitz3d.API_SetWindowLong = (hwnd: number, nIndex: number, dwNewLong: number) => {
    return 0;
  };

  imports.blitz3d.API_SetWindowPos = (hwnd: number, hWndInsertAfter: number, X: number, Y: number, cx: number, cy: number, uFlags: number) => {
    return 1;
  };
}

export function setupWin32(graphics: any, imports: any) {
  registerWin32Stubs(imports, {
    canvas: graphics?.core?.canvas,
    readString: (ptr: number) => graphics?.core?.readString?.(ptr) ?? "",
  });
}
