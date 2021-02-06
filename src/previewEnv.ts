import fs from "fs";
import path from "path";
import {PreviewConfig} from "./previewConfig";
import YAML from "yaml";
import {getMainFileName} from "./utils";

const PREVIEW_ENV_PATH = path.join(process.cwd(), "preview");
const TEMP_DIR = path.join(PREVIEW_ENV_PATH, "temp")
const STORAGE_DIR = path.join(PREVIEW_ENV_PATH, "storage")

function isInitialized() {
    return fs.existsSync(PREVIEW_ENV_PATH)
        && fs.statSync(PREVIEW_ENV_PATH).isDirectory()
        && fs.existsSync(TEMP_DIR) && fs.statSync(TEMP_DIR).isDirectory()
        && fs.existsSync(STORAGE_DIR) && fs.statSync(STORAGE_DIR).isDirectory()
}

export function runningInstanceExists() {
    if (!isInitialized()) {
        return false;
    }
    const directory = fs.opendirSync(TEMP_DIR);
    const hasFiles = directory.readSync() != null;
    directory.closeSync();
    return hasFiles;
}

export function runInitializePreviewEnv(args: string[]) {
    const target = PREVIEW_ENV_PATH;
    if (fs.existsSync(target)) {
        throw new Error("Preview environment target already exists: " + target);
    }
    fs.mkdirSync(target);
    fs.mkdirSync(path.join(target, "storage"));
    fs.mkdirSync(path.join(target, "temp"));
}

/**
 * Registers the target preview.yaml into the storage. The storage directory contains text files; the filename
 * is the ID of the preview file, and the content of the file is the path to the preview file.
 * @param args
 */
export function register(args: string[]) {
    const target = args[0];
    const config: PreviewConfig = YAML.parse(fs.readFileSync(target, 'utf-8'));
    const id = config.id ?? getMainFileName(target);
    fs.writeFileSync(path.join(PREVIEW_ENV_PATH, "storage", id), path.resolve(target));
}

export function unregister(args: string[]) {
    const id = args[0];
    fs.unlinkSync(path.join(PREVIEW_ENV_PATH, "storage", id))
}

export function getPathFromId(id: string): string {
    const target = path.join(PREVIEW_ENV_PATH, "storage", id)
    if (!fs.existsSync(target)) {
        throw new Error(`Could not find path associated with id ${id}`);
    }
    return fs.readFileSync(target, 'utf-8')
}

/**
 * Takes the source file, either the given argument or by default "src/index.tsx" and copies it into a
 * temporary file. Returns the data of the source file and the path to the temporary file.
 */
export function saveIndex(srcFile?: string): {
    originalFile: string;
    savedData: string;
    savedFile: string;
} {
    const src = srcFile ?? path.join(process.cwd(), "src", "index.tsx");
    const dest = path.join(PREVIEW_ENV_PATH, "temp", Date.now().toString() + ".tsx");
    fs.copyFileSync(src, dest);
    const data = fs.readFileSync(dest, 'utf-8');
    return {
        originalFile: src,
        savedData: data,
        savedFile: dest,
    }
}

/**
 * Restores the original file that was used by saveIndex(), writing the data into the original source file.
 * If writing the data fails, then it attempts again by using the temporary savedFile.
 * @param originalFile
 * @param data
 * @param savedFile
 */
export function recoverIndex(originalFile: string, data: string, savedFile: string) {
    try {
        fs.writeFileSync(originalFile, data, 'utf-8');
    } catch (e) {
        fs.copyFileSync(savedFile, originalFile);
    }
    fs.unlinkSync(savedFile);
}
