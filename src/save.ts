import path from 'path';
import fs from 'fs';
import { TEMP_DIR } from './constants';

/**
 * Takes the source file, either the given argument or by default "src/index.tsx" and copies it into a
 * temporary file. Returns the data of the source file and the path to the temporary file.
 */
export function saveIndex(srcFile?: string): {
    data: string;
    savedFile: string;
} {
    const src = srcFile ?? path.join(process.cwd(), "src", "index.tsx");
    const dest = path.join(TEMP_DIR, "index.tsx");
    fs.copyFileSync(src, dest);
    const data = fs.readFileSync(dest, 'utf-8');
    return {
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
