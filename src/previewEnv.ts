import fs from "fs";
import path from "path";
import {PreviewConfig} from "./previewConfig";
import YAML from "yaml";
import {getMainFileName} from "./utils";
import {STORAGE_DIR, TEMP_DIR} from "./constants";

function isInitialized() {
    return fs.existsSync(path.join(process.cwd(), "preview"))
        && fs.statSync(path.join(process.cwd(), "preview")).isDirectory();
}

export function runInitializePreviewEnv(args: string[]) {
    const name = args.length > 0 ? args[0] : "preview";
    const target = path.join(process.cwd(), name);
    if (fs.existsSync(target)) {
        throw new Error("Error: preview environment target already exists: " + target);
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
    const config: PreviewConfig = YAML.parse(target);
    const id = config.id ?? getMainFileName(target);
    fs.writeFileSync(path.join(STORAGE_DIR, id), path.resolve(target));
}

export function unregister(args: string[]) {
    const id = args[0];
    fs.unlinkSync(path.join(STORAGE_DIR, id))
}

export function getPathFromId(id: string): string | undefined {
    const target = path.join(STORAGE_DIR, id)
    if (!fs.existsSync(target)) {
        return undefined;
    }
    return fs.readFileSync(target, 'utf-8')
}

/**
 * Takes the source file, either the given argument or by default "src/index.tsx" and copies it into a
 * temporary file. Returns the data of the source file and the path to the temporary file.
 */
export function saveIndex(srcFile?: string): {
    originalFile: string;
    data: string;
    savedFile: string;
} {
    const src = srcFile ?? path.join(process.cwd(), "src", "index.tsx");
    const dest = path.join(TEMP_DIR, "index.tsx");
    fs.copyFileSync(src, dest);
    const data = fs.readFileSync(dest, 'utf-8');
    return {
        originalFile: src,
        data: data,
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
