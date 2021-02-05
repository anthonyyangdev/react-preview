#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {getComponentName, getDimensions, getImportStyle, getProps, PreviewConfig} from "./previewConfig";
import {recoverIndex, saveIndex} from './save';
import { convertToCodeString } from './utils';

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

function buildPreviewIndex(componentPath: string): string {
    const componentProps = {};
    let importStmt: string = "";
    let outputFile = defaultOutputFile;
    let height = "100%";
    let width = "100%";

    let importPath: string;
    let componentName = "MyComponent";
    if (fs.statSync(componentPath).isDirectory()) {
        // Find preview.yaml
        const previewYaml = path.join(componentPath, "preview.yaml");
        if (!fs.existsSync(previewYaml)) {
            throw new Error("Cannot find preview.yaml file");
        }
        const config: PreviewConfig = YAML.parse(fs.readFileSync(previewYaml, 'utf-8'));
        componentPath = path.join(componentPath, config.source);
        const importStyle = getImportStyle(config);
        componentName = getComponentName(config);
        const relativePath = path.relative(path.dirname(outputFile), componentPath);
        const ext = path.extname(relativePath);
        importPath = "./" + relativePath.slice(0, relativePath.length - ext.length);

        switch (importStyle) {
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
        width = dimensions.width;
        height = dimensions.height;
        Object.assign(componentProps, getProps(config));
    } else {
        const relativePath = path.relative(path.dirname(outputFile), componentPath);
        const ext = path.extname(relativePath);
        importPath = "." + path.sep + relativePath.slice(0, relativePath.length - ext.length);
        importStmt = `import MyComponent from '${importPath}'`;
    }
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Error: Component file does not exist: ${componentPath}`);
    }
    const propsArg = Object.entries(componentProps)
        .map(([k, v]) => `${k}={${convertToCodeString(v)}}`).join(" ");
    const styleArgs = `style={{height: ${JSON.stringify(height)}, width: ${JSON.stringify(width)}}}`

    const element = `<div ${styleArgs}><${componentName} ${propsArg} /></div>`;
    return baseCode(importStmt, element);
}

/**
 * Builds src/dev-config.ts to run the browser or to run preview
 * @param {string[]} args
 */
async function main(args: string[]) {
    const [,, mode, targetFile] = args;
    switch (mode) {
        case "preview":
            const {data, savedFile} = saveIndex();
            const newData = buildPreviewIndex(targetFile);
            fs.writeFileSync(defaultOutputFile, newData, 'utf-8');
            process.on('SIGINT', () => recoverIndex(defaultOutputFile, data, savedFile));
            process.on('SIGTERM', () => recoverIndex(defaultOutputFile, data, savedFile));
            const childProcess = child_process.spawn('npm', ['run', 'start'],
                {stdio: [process.stdin, process.stdout, process.stderr]});
            await onExit(childProcess);
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
