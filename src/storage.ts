import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { STORAGE_DIR } from './constants';
import { PreviewConfig } from './previewConfig';
import { getMainFileName } from './utils';

/**
 * Registers the target preview.yaml into the storage. The storage directory contains text files; the filename
 * is the ID of the preview file, and the content of the file is the path to the preview file.
 * @param target 
 */
export function register(target: string) {
    const config: PreviewConfig = YAML.parse(target);
    const id = config.id ?? getMainFileName(target);
    fs.writeFileSync(path.join(STORAGE_DIR, id), path.resolve(target));
}

export function unregister(id: string) {
    fs.unlinkSync(path.join(STORAGE_DIR, id))
}

export function getPathFromId(id: string): string | undefined {
    const target = path.join(STORAGE_DIR, id)
    if (!fs.existsSync(target)) {
        return undefined;
    }
    return fs.readFileSync(target, 'utf-8')
}