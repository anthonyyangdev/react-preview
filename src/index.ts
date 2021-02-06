#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {getComponentName, getImportStyle, getProps, getReactStyles, PreviewConfig} from "./previewConfig";
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

/**
 * Resolves the path the target argument for run-preview, which may either be a preview file, a directory
 * which contains a preview file, or a registered id with a path to the preview file.
 * @param targetArg
 */
function resolvePreviewFileArg(targetArg: string): string {
    if (fs.existsSync(targetArg)) {
        // may be a directory or file
        if (fs.statSync(targetArg).isDirectory()) {
            const previewFile = path.join(targetArg, "preview.yaml");
            if (fs.existsSync(previewFile)) {
                return previewFile;
            }
        } else if (fs.statSync(targetArg).isFile()) {
            return targetArg;
        }
    }
    return getPathFromId(targetArg);
}

function buildPreviewIndex(previewFile: string): string {
    const componentProps = {};
    const outputFile = defaultOutputFile;

    const config = YAML.parse(fs.readFileSync(path.join(previewFile, "preview.yaml"), 'utf-8'));
    const componentPath = path.join(previewFile, config.source);
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Error: Component file does not exist: ${componentPath}`);
    }

    const componentName = getComponentName(config);
    const relativePath = path.relative(path.dirname(outputFile), componentPath);
    const ext = path.extname(relativePath);
    const importPath = "./" + relativePath.slice(0, relativePath.length - ext.length);

    let importStmt = "";
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
    Object.assign(componentProps, getProps(config));

    const propsArg = Object.entries(componentProps)
        .map(([k, v]) => `${k}={${convertToCodeString(v)}}`).join(" ");
    const styleArgs = `style={{${JSON.stringify(getReactStyles(config))}}}`
    const element = `<div ${styleArgs}><${componentName} ${propsArg} /></div>`;
    return baseCode(importStmt, element);
}

async function runPreview(args: string[]) {
    const target = args[0];
    if (target === undefined) {
        throw new Error("Must provide a target preview file, a directory which contains the preview file, or a" +
            " registered id");
    }
    const {originalFile, data, savedFile} = saveIndex(args[1]);
    const previewFile = resolvePreviewFileArg(target);
    const newData = buildPreviewIndex(previewFile);
    fs.writeFileSync(originalFile, newData, 'utf-8');
    process.on('SIGINT', () => recoverIndex(originalFile, data, savedFile));
    process.on('SIGTERM', () => recoverIndex(originalFile, data, savedFile));
    const childProcess = child_process.spawn('npm', ['run', 'start'],
        {stdio: [process.stdin, process.stdout, process.stderr]});
    await onExit(childProcess);
}

/**
 * Builds src/dev-config.ts to run the browser or to run preview
 */
async function main(args: string[]) {
    const [,, mode, ...modeArgs] = args;
    switch (mode) {
        case "preview":
            return runPreview(modeArgs);
        case "init":
            return runInitializePreviewEnv(modeArgs);
        case "register":
            return register(modeArgs);
        case "unregister":
            return unregister(modeArgs);
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
