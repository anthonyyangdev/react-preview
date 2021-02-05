
/**
 * Returns true if the given value is a function. Otherwise, returns false.
 * @param functionToCheck 
 */
export function isFunction(functionToCheck: unknown) {
    return {}.toString.call(functionToCheck) === '[object Function]';
}

/**
 * Creates a string version of the given value. For example, if the given value is the string "Hello",
 * then the output will be "\"Hello\"". If the given value is a function () => alert('Me'), then the output
 * will be "() => alert('Me')".
 * @param value 
 */
export function convertToCodeString(value: unknown): string {
    if (value == null || isFunction(value)) {
        return `${value}`;
    }
    return JSON.stringify(value);
}