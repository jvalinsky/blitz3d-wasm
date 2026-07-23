/**
 * A-M0 Entrypoint Contract — frozen export names (decision D2).
 *
 * Shared between the SCPCB compile tool and CI gate tests.
 * Bump __CmdBufAbiVersion when the ABI changes.
 *
 * See plan/subplans/05_scpcb_integration.md
 */

/** Web_* entrypoint names required by the A-M0 contract. */
export const REQUIRED_WEB_EXPORTS = [
  "Web_InitOnce",
  "Web_Tick",
  "Web_EnterMenu",
  "Web_LeaveMenu",
  "Web_EnterGame",
  "Web_LeaveGame",
] as const;

/** Command-buffer ABI globals required for Track B builds. */
export const REQUIRED_CMDBUF_EXPORTS = [
  "__CmdBufPtr",
  "__CmdBufBytes",
  "__CmdBufAbiVersion",
] as const;
