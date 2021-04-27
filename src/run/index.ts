import fs from "fs";
import child_process from "child_process";
import path from "path";
import YAML from "yaml";
import {getComponentName, getImportStyle, getProps, getReactStyles, PreviewConfig} from "../previewConfig";
import {convertToCodeString} from "../utils";
import * as uuid from "uuid";
import {REACT_PREVIEW_DIR} from "../constants";
import * as readline from "readline";


const baseCode = (importStmt: string, componentRender: string) => `
// This content was auto-generated! DO NOT ATTEMPT TO EDIT OR REMOVE

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
 * which contains a preview file.
 * @param targetArg
 */
async function resolvePreviewFileArg(targetArg: string): Promise<string> {
    if (!fs.existsSync(targetArg)) {
        throw new Error(`Cannot find directory or file named ${targetArg}`);
    }
    // may be a directory or file
    let previewFile: string;
    let sourceFile: string;
    if (fs.statSync(targetArg).isDirectory()) {
        previewFile = path.join(targetArg, "preview.yaml");
    } else if (fs.statSync(targetArg).isFile()) {
        const ext = path.extname(targetArg);
        if ([".yaml", ".yml"].includes(ext)) {
            previewFile = targetArg;
        } else {
            previewFile = path.join(path.dirname(targetArg), "preview.yaml");
        }
        if (['tsx', 'ts', 'js', 'jsx'].includes(targetArg)) {
            sourceFile = targetArg;
        }
    } else {
        throw new Error(`Cannot OPEN ${targetArg}`);
    }
    if (fs.existsSync(previewFile)) {
        return previewFile;
    }
    console.log(`Cannot find a preview file at ${previewFile}`);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((_, reject) => {
        rl.question("Do you want to create a template preview file? ", answer => {
            if (['y', 'yes', 'ok', 'yep', 'yeah'].includes(answer.toLowerCase())) {
                fs.writeFileSync(previewFile, `
source: ${path.relative(path.dirname(previewFile), sourceFile)}
props: {}
`, 'utf-8');
            }
            rl.close();
            reject('Process ended');
        });
    });
}

function buildPreviewIndex(previewFile: string, indexFile: string): string {
    const outputFile = indexFile;

    const config: PreviewConfig = YAML.parse(fs.readFileSync(previewFile, 'utf-8'));
    const componentPath = path.join(path.dirname(previewFile), config.source);
    if (!fs.existsSync(componentPath)) {
        throw new Error(`Component file does not exist: ${componentPath}`);
    }

    const componentName = getComponentName(config);
    const relativePath = path.relative(path.dirname(outputFile), componentPath);
    const ext = path.extname(relativePath);
    const importPath = JSON.stringify("./" + relativePath.slice(0, relativePath.length - ext.length));

    let importStmt = "";
    switch (getImportStyle(config)) {
        case "default":
            importStmt = `import ${componentName} from ${importPath}`; break;
        case "target":
            importStmt = `import {${componentName}} from ${importPath}`; break;
        case "namespace":
            importStmt = `import * as ${componentName} from ${importPath}`; break;
        case "require":
            importStmt = `const ${componentName} = require(${importPath})`; break;
    }
    const componentProps = {};
    Object.assign(componentProps, getProps(config));

    const propsArg = Object.entries(componentProps)
    .map(([k, v]) => `${k}={${convertToCodeString(v)}}`).join(" ");
    const styleArgs = `style={${JSON.stringify(getReactStyles(config))}}`
    const element = `<div ${styleArgs}><${componentName} ${propsArg} /></div>`;
    return baseCode(importStmt, element);
}


function getIndexFilenameAndLanguage(directory?: string) {
    directory = directory || path.join(process.cwd(), "src");
    if (!fs.existsSync(directory)) {
        throw new Error(`Directory ${directory} does not exist.`);
    }
    const tscConfig = path.join(directory, "tsconfig.json");
    let indexFilename: string;
    let language: "ts" | "js";
    if (fs.existsSync(tscConfig)) {
        console.log('Found a tsconfig.json file. Assuming this is a TypeScript project');
        indexFilename = path.join(directory, "index.tsx");
        language = "ts";
    } else {
        indexFilename = path.join(directory, "index.jsx");
        language = "js";
    }
    if (!indexFilename || !language) {
        throw new Error('Could not determine if this is a JS or TS project');
    }
    return {indexFilename, language}
}


export function runningInstanceExists(indexFilename: string) {
    const directory = fs.opendirSync(REACT_PREVIEW_DIR);
    while (true) {
        const entry = directory.readSync();
        if (entry == null) {
            break;
        }
        const filename = path.join(REACT_PREVIEW_DIR, entry.name)
        if (entry.isFile() && filename.startsWith("react_preview_")) {
            const data = fs.readFileSync(filename, 'utf-8');
            const json = JSON.parse(data);
            if (json.indexFilename === indexFilename) {
                directory.closeSync();
                return true;
            }
        }
    }
    directory.closeSync();
    return false;
}


export default async function runPreview(args: string[]) {
    const target = args[0];
    if (target === undefined) {
        throw new Error("Must provide a target preview file, a directory which contains the preview file, or a React" +
            " file.");
    }
    const {indexFilename, language} = getIndexFilenameAndLanguage(args[1]);
    if (runningInstanceExists(indexFilename)) {
        throw new Error(`React preview is already running for this directory/project`);
    }

    let saveData: {
        fileData: string;
        fileMode: number;
        cwd: string;
        language: 'js' | 'ts';
        indexFilename: string;
        newSaveFile: string;
    } | undefined;
    if (fs.existsSync(indexFilename)) {
        // Index already exists. Must be saved.
        console.log(`A file named ${indexFilename} already exists. Will be saving an writing over it`);
        const fileData = fs.readFileSync(indexFilename, 'utf-8');
        const fileMode = fs.statSync(indexFilename).mode;
        const cwd = process.cwd();

        const newSaveFile = path.join(REACT_PREVIEW_DIR, "react_preview_" + uuid.v4() + ".json");
        saveData = {fileData, fileMode, cwd, language, indexFilename, newSaveFile};
        fs.writeFileSync(newSaveFile, JSON.stringify(saveData), 'utf-8');
    }

    const previewFile = await resolvePreviewFileArg(target);
    const newData = buildPreviewIndex(previewFile, indexFilename);
    fs.writeFileSync(indexFilename, newData, 'utf-8');
    const fileWatcher = fs.watch(previewFile, () => {
        try {
            const newData = buildPreviewIndex(previewFile, indexFilename);
            fs.writeFileSync(indexFilename, newData, 'utf-8');
        } catch (e) {}
    });
    const cleanup = () => {
        fileWatcher.close();
        if (!saveData) return;
        const {fileData, newSaveFile, indexFilename} = saveData;
        fs.unlinkSync(indexFilename);
        fs.writeFileSync(indexFilename, fileData, 'utf-8');
        fs.unlinkSync(newSaveFile);
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    const command = fs.existsSync(path.join(process.cwd(), "yarn.lock")) ? "yarn" : "npm";
    const childProcess = child_process.spawn(command, ['run', 'start'],
        {stdio: [process.stdin, process.stdout, process.stderr]});
    await onExit(childProcess);
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
