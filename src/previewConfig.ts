
const defaultOutputFile = "./src/preview-tools.tsx";
const defaultLanguage: LanguageOutput = "ts";
const defaultImportStyle: ImportStyle = "default"
const defaultHeight = "auto";
const defaultWidth = "auto";

export function getOutputFile(config: PreviewConfig): string {
    return config.output ?? defaultOutputFile;
}
export function getLanguage(config: PreviewConfig): LanguageOutput {
    return config.language ?? defaultLanguage
}
export function getDimensions(config: PreviewConfig): {height: string, width: string} {
    return { height: config.height ?? defaultHeight, width: config.width ?? defaultWidth};
}
export function getImportStyle(config: PreviewConfig): ImportStyle {
    return config.importStyle ?? defaultImportStyle;
}

/**
 * Converts a propconfig object into an actual React prop object.
 * @param config
 */
export function getProps(config: PreviewConfig): unknown {
    function parseObject(object: Record<string, PropsConfig>) {
        const value: Record<string, unknown> = {};
        Object.entries(object).forEach(([k, v]) => {
            return value[k] = parseValue(v);
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
            return props;
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
    return config.props ? parseValue(config.props) : {};
}

type LanguageOutput = "ts" | "js";
type ImportStyle = "default" | "target" | "namespace" | "require";
export type PreviewConfig = {
    id: string;
    source: string;

    // Defaults to src/preview-tools.tsx
    output?: string;

    // Defaults to ts
    language?: LanguageOutput;

    height?: string;
    width?: string;

    // Defaults to "default", i.e. "import name from './Component'"
    importStyle?: "default" | "target" | "namespace" | "require";
    props?: PropsConfig;
};

export type PropsConfig =
    ObjectValue
    | ArrayValue
    | StringValue
    | BooleanValue
    | NumberValue
    | NullValue
    | UndefinedValue
    | FunctionValue
    | PropsConfig[]
    | number
    | string
    | boolean
    | GeneralObject;

type GeneralObject = {[k: string]: PropsConfig} & { type?: undefined }

type ObjectValue = {
    type: "object";
    value: Record<string, PropsConfig>;
};

type ArrayValue = {
    type: "array";
    value: PropsConfig[];
};

type StringValue = {
    type: "string";
    value: string;
};

type BooleanValue = {
    type: "boolean";
    value: boolean;
};

type NumberValue = {
    type: "number";
    value: number;
};

type NullValue = {
    type: "null";
    value: null;
}

type UndefinedValue = {
    type: "undefined";
}

type JSFunctionString = string;
type FunctionValue = {
    type: "function";
    value: JSFunctionString;
};
