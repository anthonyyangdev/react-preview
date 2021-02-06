import path from "path";

const defaultImportStyle: ImportStyle = "default"
const defaultHeight = "auto";
const defaultWidth = "auto";

export function getImportStyle(config: PreviewConfig): ImportStyle {
    return config.importStyle ?? defaultImportStyle;
}
export function getReactStyles(config: PreviewConfig): Record<string, unknown> {
    const dimensions = { height: config.height ?? defaultHeight, width: config.width ?? defaultWidth};
    return Object.assign(dimensions, config.style ?? {});
}
export function getComponentName(config: PreviewConfig): string {
    const {componentName, source} = config;
    if (componentName != null) return componentName;

    const basename = path.basename(source);
    let extension = path.extname(source);
    let filename = basename.slice(0, basename.length - extension.length);
    while (!filename.match(/^[a-zA-Z_][a-zA-Z_0-9]*$/)) {
        extension = path.extname(filename);
        filename = basename.slice(0, filename.length - extension.length);
    }
    return filename;
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

    function parseFunctionSpec(spec: JSFunctionSpec): Function {
        const args = "(" + spec.args.join(", ") + ")";
        const body = spec.body ?? "";
        let fn = "";
        if (spec.throws != null) {
            fn = args + " => " + "{\n" + body + "\n throw new Error(" + JSON.stringify(spec.throws) + "); }";
        } else {
            const ret = "return " + spec.retValues.join(", ");
            fn = args + " => " + "{\n" + body + "\n " + ret + "; }";
        }
        return parseFunction(fn);
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
            switch (props.type) {
                case 'object':
                    return parseObject(props.value);
                case 'number':
                    return parseNumber(props.value);
                case 'string':
                    return props.value;
                case 'function':
                    if (props.spec != null) {
                        return parseFunctionSpec(props.spec);
                    }
                    return parseFunction(props.value ?? "() => { return; }");
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
    source: string;
    id?: string;
    componentName?: string;

    // Defaults to src/preview-tools.tsx
    output?: string;

    // Defaults to ts
    language?: LanguageOutput;

    height?: string;
    width?: string;

    // Defaults to "default", i.e. "import name from './Component'"
    importStyle?: "default" | "target" | "namespace" | "require";
    props?: PropsConfig;
    style?: Record<string, unknown>
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
type JSFunctionSpec = {
    args: unknown[];
    retValues: unknown[];
    body?: string;
    throws?: string;
};
type FunctionValue = {
    type: "function";
    value?: JSFunctionString;
    spec?: JSFunctionSpec;
};
