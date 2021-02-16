#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {getComponentName, getImportStyle, getProps, getReactStyles, PreviewConfig} from "./previewConfig";
import { convertToCodeString } from './utils';
import {
    getPathFromId,
    recoverIndex,
    register,
    runInitializePreviewEnv,
    runningInstanceExists,
    saveIndex,
    unregister
} from "./previewEnv";

const defaultOutputFile = "./src/index.tsx";
const baseCode = (importStmt: string, componentRender: string) => `
// This content was auto-generated! DO NOT ATTEMPT TO EDIT OR REMOVE
// THIS FILE ONLY HAS READ PERMISSION

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

    const config = YAML.parse(fs.readFileSync(previewFile, 'utf-8'));
    const componentPath = path.join(path.dirname(previewFile), config.source);
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Component file does not exist: ${componentPath}`);
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
    const styleArgs = `style={${JSON.stringify(getReactStyles(config))}}`
    const element = `<div ${styleArgs}><${componentName} ${propsArg} /></div>`;
    return baseCode(importStmt, element);
}

async function runPreview(args: string[]) {
    if (runningInstanceExists()) {
        throw new Error("Cannot run preview because there is already another instance running.");
    }

    const target = args[0];
    if (target === undefined) {
        throw new Error("Must provide a target preview file, a directory which contains the preview file, or a" +
            " registered id");
    }
    let {originalFile, savedData, savedFile, originalMode} = saveIndex(args[1]);
    const previewFile = resolvePreviewFileArg(target);
    const newData = buildPreviewIndex(previewFile);
    fs.writeFileSync(originalFile, newData, 'utf-8');
    const fileWatcher = fs.watch(previewFile, (curr, prev) => {
        try {
            const newData = buildPreviewIndex(previewFile);
            fs.writeFileSync(originalFile, newData, 'utf-8');
        } catch (e) {}
    });
    const cleanup = () => {
        fileWatcher.close();
        recoverIndex(originalFile, savedData, savedFile, originalMode);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
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
        case "run":
            return runPreview(modeArgs);
        case "init":
            return runInitializePreviewEnv(modeArgs);
        case "register":
            return register(modeArgs);
        case "unregister":
            return unregister(modeArgs);
        default:
            throw new Error("Could not find an action for mode: " + mode);
    }
}

function onExit(childProcess: child_process.ChildProcessByStdio<null, null, null>) {
    return new Promise((resolve, reject) => {
        childProcess.once('exit', () => {
            resolve(undefined);
        });
        childProcess.once('error', (err) => {
            reject(err);
        });
    });
}

main(process.argv)
    .then(() => console.log("Process complete"))
    .catch(e => console.log(`${e}`));
