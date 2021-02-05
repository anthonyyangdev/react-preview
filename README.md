# react-preview

> A command-line tool to generate previews of React components in a React project.

## Purpose

This tool is intended to be used for developing a particular React component without needing to manually modify existing files. It is inspired by the SwiftUI preview tool available in XCode for previewing SwiftUI components.

## Notes

Currently only supported and tested on React projects created via `create-react-app` and TypeScript. This is still a work in progress with many details missing.

## Local Setup

Clone or download the repository. Open the project directory in a terminal and execute the following command:
```sh
# If you have yarn (preferred)
yarn run setup

# If you have npm only,
npm run setup-npm
```
After running the above command with no errors, you will be able to use the `react-preview` in any directory. 

## Usage

### Basic Usage

Create a `preview.yaml` file in the directory that contains a React component file. The `preview.yaml`
 file instructs `react-preview` how to load a preview of the component. The following shows a typical file setup where
`react-preview` may be used:

```tsx
// src/Components/MyComponent.tsx
export default function MyComponent() {
    return <div>
        <h1>Hello World</h1>
    </div>
}
```
```yaml
# src/Components/preview.yaml
source: MyComponent.tsx
```

In the `preview.yaml` file, the value of the `source` key is the React component file to preview. The value may be an absolute path or a relative path to that file.

With this setup prepared, we can start the preview by running `react-preview preview <path to directory with preview.yaml>`, which will set up the preview mode for that component.

### Props

`react-preview` supports creating props by using the `props` field in the `preview.yaml` file. Suppose we had a React component that uses props, then it can be previewed via the following set of files.

```tsx
// src/Components/MessageBox.tsx
export default function MessageBox(props: {
    message: string;
}) {
    return <div>
        <h1>{props.message}</h1>
    </div>
}
```
```yaml
# src/Components/preview.yaml
source: MessageBox.tsx

props:
  message: Hello World
```

The preview props supports the standard values supported by YAML, e.g. strings, integers, floats, booleans, arrays, null, and objects.
The preview prop also supports functions by declaring an object with `type: function` in the `preview.yaml` file. For a practical example, consider the following file set up:

```tsx
// src/Components/ActionButton.tsx
export default function ActionButton(props: {
    action(): void;
}) {
    return <div onClick={props.action}>
        This is a clickable region.
    </div>
}
```
```yaml
# src/Components/preview.yaml
source: ActionButton.tsx

props:
  action:
    type: function
    value: "() => alert('You clicked me!')"
```

## License

MIT © [Anthony Yang]()
