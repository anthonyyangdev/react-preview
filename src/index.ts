#!/usr/bin/env node
import fs from 'fs';
import {REACT_PREVIEW_DIR} from "./constants";

import runPreview from "./run";

/**
 * Builds src/dev-config.ts to run the browser or to run preview
 */
async function main(args: string[]) {
    // Touch ~/.react-preview directory
    if (!fs.existsSync(REACT_PREVIEW_DIR)) {
        fs.mkdirSync(REACT_PREVIEW_DIR);
    } else if (!fs.statSync(REACT_PREVIEW_DIR).isDirectory()) {
        throw new Error(`A file named ${REACT_PREVIEW_DIR} was found when a directory was expected. Please delete/rename this file or in order to continue`)
    }

    const [,, mode, ...modeArgs] = args;
    switch (mode) {
        case "run":
            return runPreview(modeArgs);
        default:
            throw new Error("Could not find an action for mode: " + mode);
    }
}


main(process.argv)
    .then(() => console.log("Process complete"))
    .catch(e => console.log(`${e}`));
