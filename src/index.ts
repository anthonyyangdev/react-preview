#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {getComponentName, getDimensions, getImportStyle, getProps, PreviewConfig} from "./previewConfig";
import { convertToCodeString } from './utils';
import {getPathFromId, recoverIndex, register, runInitializePreviewEnv, saveIndex, unregister} from "./previewEnv";

const defaultOutputFile = "./src/index.tsx";
const baseCode = (importStmt: string, componentRender: string) => `
import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
${importStmt}

ReactDOM.render(
  <React.StrictMode>
    ${componentRender}
  </React.StrictMode>,
  document.getElementById('root')
);
`;

function buildPreviewIndex(previewPath: string): string {
    const componentProps = {};
    let importStmt = "";
    let outputFile = defaultOutputFile;

    let config: PreviewConfig;
    if (fs.statSync(previewPath).isDirectory()
        && fs.existsSync(path.join(previewPath, "preview.yaml"))) {
        config = YAML.parse(fs.readFileSync(path.join(previewPath, "preview.yaml"), 'utf-8'));
    } else if (fs.existsSync(previewPath)) {
        config = YAML.parse(fs.readFileSync(previewPath, 'utf-8'));
    } else {
        // Assume the preview path is an id.
        const file = getPathFromId(previewPath)
        if (file != null && fs.existsSync(file)) {
            config = YAML.parse(fs.readFileSync(file, 'utf-8'));
        } else {
            throw new Error("Preview file not found");
        }
    }

    const componentPath = path.join(previewPath, config.source);
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Error: Component file does not exist: ${componentPath}`);
    }

    const componentName = getComponentName(config);
    const relativePath = path.relative(path.dirname(outputFile), componentPath);
    const ext = path.extname(relativePath);
    const importPath = "./" + relativePath.slice(0, relativePath.length - ext.length);

    switch (getImportStyle(config)) {
        case "default":
            importStmt = `import ${componentName} from '${importPath}'`;
            break;
        case "target":
            importStmt = `import {${componentName}} from '${importPath}'`;
            break;
        case "namespace":
            importStmt = `import * as ${componentName} from '${importPath}'`;
            break;
        case "require":
            importStmt = `const ${componentName} = require('${importPath}')`;
            break;
    }
    const dimensions = getDimensions(config);
    const width = dimensions.width;
    const height = dimensions.height;
    Object.assign(componentProps, getProps(config));

    const propsArg = Object.entries(componentProps)
        .map(([k, v]) => `${k}={${convertToCodeString(v)}}`).join(" ");
    const styleArgs = `style={{height: ${JSON.stringify(height)}, width: ${JSON.stringify(width)}}}`

    const element = `<div ${styleArgs}><${componentName} ${propsArg} /></div>`;
    return baseCode(importStmt, element);
}

async function runPreview(args: string[]) {
    const targetFile = args[0];
    const {originalFile, data, savedFile} = saveIndex(args[1]);
    const newData = buildPreviewIndex(targetFile);
    fs.writeFileSync(originalFile, newData, 'utf-8');
    process.on('SIGINT', () => recoverIndex(originalFile, data, savedFile));
    process.on('SIGTERM', () => recoverIndex(originalFile, data, savedFile));
    const childProcess = child_process.spawn('npm', ['run', 'start'],
        {stdio: [process.stdin, process.stdout, process.stderr]});
    await onExit(childProcess);
}

/**
 * Builds src/dev-config.ts to run the browser or to run preview
 * @param {string[]} args
 */
async function main(args: string[]) {
    const [,, mode, ...modeArgs] = args;
    switch (mode) {
        case "preview":
            return runPreview(modeArgs);
        case "init":
            return runInitializePreviewEnv(modeArgs);
        case "register":
            register(modeArgs);
            break;
        case "unregister":
            unregister(modeArgs);
            break;
        default:
            throw new Error("Error: Could not find an action for mode: " + mode);
    }
}

function onExit(childProcess: child_process.ChildProcessByStdio<null, null, null>) {
    return new Promise((resolve, reject) => {
        childProcess.once('exit', (code) => {
            if (code === 0) {
                resolve(undefined);
            } else {
                reject(new Error('Exit with error code: '+code));
            }
        });
        childProcess.once('error', (err) => {
            reject(err);
        });
    });
}

main(process.argv)
    .then(() => console.log("Process complete"))
    .catch(e => console.log("Error: " + e));
