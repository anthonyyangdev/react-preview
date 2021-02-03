
import fs from 'fs';
import path from 'path';
import child_process from 'child_process';
import YAML from 'yaml';
import {PreviewConfig, PropsConfig} from "./previewConfig";

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

function parseObject(object: Record<string, unknown>) {
    const value: Record<string, unknown> = {};
    Object.entries(object).forEach(([k, v]) => {
        value[k] = parseValue(v);
    });
    return value;
}

function parseNumber(number: number): number {
    return number
}

function parseFunction(fn: string): Function {
    return Function(`"use strict";return (${fn})`)(); // eslint-disable-line
}

function parseArray(arr: PropsConfig[]): unknown[] {
    return arr.map(parseValue);
}

function parseValue(props: PropsConfig): unknown {
    if (Array.isArray(props)) {
        return parseArray(props);
    }
    if (typeof props !== "object") {
        return props;
    }
    if (props == null) {
        return {};
    }
    if ('type' in props) {
        // const {value, type} = props as Record<'type' | 'value', unknown>;
        switch (props.type) {
            case 'object':
                return parseObject(props.value);
            case 'number':
                return parseNumber(props.value);
            case 'string':
                return props.value;
            case 'function':
                return parseFunction(props.value);
            default:
                throw new Error("Invalid type in preview.yaml: " + props.type);
        }
    }
    return parseObject(props);
}

function buildPreviewConfig(componentPath: string) {
    const componentProps = {};
    let outputFile = defaultOutputFile;

    if (fs.statSync(componentPath).isDirectory()) {
        // Find preview.yaml
        const previewYaml = path.join(componentPath, "preview.yaml");
        if (!fs.existsSync(previewYaml)) {
            throw new Error("Cannot find preview.yaml file");
        }
        const config: PreviewConfig = YAML.parse(fs.readFileSync(previewYaml, 'utf-8'));
        const {source, output, props} = config;

        // Update output file if possible
        outputFile = output ?? outputFile;

        componentPath = path.join(componentPath, source);
        if (props != null && typeof props === "object") {
            Object.assign(componentProps, parseValue(props));
        }
    }
    const relativePath = path.relative(path.dirname(outputFile), componentPath);
    const ext = path.extname(relativePath);
    const importPath = "." + path.sep + relativePath.slice(0, relativePath.length - ext.length);
    const importStmt = `import MyComponent from '${importPath}'`;

    const propsArg = Object.entries(componentProps)
    .map(([k, v]) => `${k}={${typeof v === 'object' ? JSON.stringify(v, undefined, 2) : v}}`).join(" ");

    const getModeFn = `export const getMode = (): DevMode => {
        return {
            mode: "preview",
            element: <MyComponent ${propsArg} />,
            source: '${importPath}'
        };
    };`;
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Error: Component file does not exist: ${componentPath}`);
    }

    const configCode = [importStmt, typeCode, getModeFn];

    fs.writeFileSync(outputFile, configCode.join("\n"));
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
