import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
export function isDirectEntry(moduleUrl) {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(moduleUrl));
}
