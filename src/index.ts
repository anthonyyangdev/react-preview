
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {getComponentName, getImportStyle, getOutputFile, getProps, PreviewConfig, PropsConfig} from "./previewConfig";

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

function buildPreviewConfig(componentPath: string) {
    const componentProps = {};
    const codeString: string[] = [typeCode];
    let outputFile = defaultOutputFile;

    let importPath: string;
    if (fs.statSync(componentPath).isDirectory()) {
        // Find preview.yaml
        const previewYaml = path.join(componentPath, "preview.yaml");
        if (!fs.existsSync(previewYaml)) {
            throw new Error("Cannot find preview.yaml file");
        }
        const config: PreviewConfig = YAML.parse(fs.readFileSync(previewYaml, 'utf-8'));
        componentPath = path.join(componentPath, config.source);
        const importStyle = getImportStyle(config);
        const componentName = getComponentName(config);
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
        Object.assign(componentProps, getProps(config));
    } else {
        const relativePath = path.relative(path.dirname(outputFile), componentPath);
        const ext = path.extname(relativePath);
        importPath = "." + path.sep + relativePath.slice(0, relativePath.length - ext.length);
        codeString.push(`import MyComponent from '${importPath}'`)
    }
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Error: Component file does not exist: ${componentPath}`);
    }

    const propsArg = Object.entries(componentProps)
        .map(([k, v]) => `${k}={${typeof v === 'object' ? JSON.stringify(v, undefined, 2) : v}}`).join(" ");

    const getModeFn = `export const getMode = (): DevMode => {
        return {
            mode: "preview",
            element: <MyComponent ${propsArg} />,
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
