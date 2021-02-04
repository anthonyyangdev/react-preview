#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {getComponentName, getDimensions, getImportStyle, getOutputFile, getProps, PreviewConfig} from "./previewConfig";

const defaultOutputFile = "./src/preview-tools.tsx";
const typeCode = `
import React from 'react';

type WebsiteMode = {
    mode: "website";
};

type PreviewMode = {
    mode: "preview";
    element: JSX.Element;
    source: string;
}

export type DevMode = WebsiteMode | PreviewMode;
`;

function buildWebsiteConfig() {
    const getModeFn = `export const getMode = (): DevMode => {return { mode: "website" };};`;
    const configCode = [typeCode, getModeFn];
    fs.writeFileSync(defaultOutputFile, configCode.join("\n"));
}

function isFunction(functionToCheck: unknown) {
    return {}.toString.call(functionToCheck) === '[object Function]';
}
function convertToCodeString(value: unknown): string {
    if (value == null || isFunction(value)) {
        return `${value}`;
    }
    return JSON.stringify(value);
}

function buildPreviewConfig(componentPath: string) {
    const componentProps = {};
    const codeString: string[] = [];
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
        importPath = "." + path.sep + relativePath.slice(0, relativePath.length - ext.length);

        switch (importStyle) {
            case "default":
                codeString.push(`import ${componentName} from '${importPath}'`)
                break;
            case "target":
                codeString.push(`import {${componentName}} from '${importPath}'`)
                break;
            case "namespace":
                codeString.push(`import * as ${componentName} from '${importPath}'`)
                break;
            case "require":
                codeString.push(`const ${componentName} from require('${importPath}')`)
                break;
        }
        outputFile = getOutputFile(config);
        const dimensions = getDimensions(config);
        width = dimensions.width;
        height = dimensions.height;
        Object.assign(componentProps, getProps(config));
    } else {
        const relativePath = path.relative(path.dirname(outputFile), componentPath);
        const ext = path.extname(relativePath);
        importPath = "." + path.sep + relativePath.slice(0, relativePath.length - ext.length);
        codeString.push(`import MyComponent from '${importPath}'`)
    }
    codeString.push(typeCode)
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Error: Component file does not exist: ${componentPath}`);
    }
    const propsArg = Object.entries(componentProps)
        .map(([k, v]) => `${k}={${convertToCodeString(v)}}`).join(" ");

    const styleArgs = `style={{height: ${JSON.stringify(height)}, width: ${JSON.stringify(width)}}}`
    const getModeFn = `export const getMode = (): DevMode => {
        return {
            mode: "preview",
            element: <div ${styleArgs}><${componentName} ${propsArg} /></div>,
            source: '${importPath}'
        };
    };`;
    codeString.push(getModeFn)
    fs.writeFileSync(outputFile, codeString.join("\n"));
}

/**
 * Builds src/dev-config.ts to run the browser or to run preview
 * @param {string[]} args
 */
async function main(args: string[]) {
    const [,, mode, targetFile] = args;
    switch (mode) {
        case "add-config":
            buildWebsiteConfig();
            return;
        case "website":
            buildWebsiteConfig();
            break;
        case "preview":
            buildPreviewConfig(targetFile);
            break;
        default:
            throw new Error("Error: Could not find an action for mode: " + mode);
    }
    const childProcess = child_process.spawn('npm', ['run', 'start'],
        {stdio: [process.stdin, process.stdout, process.stderr]});
    await onExit(childProcess);
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
