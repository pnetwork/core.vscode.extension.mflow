import { TextDocument, Position } from "vscode";

export function getTextbyRegex(
    document: TextDocument,
    position: Position,
    matchRegex: { [Symbol.match](string: string): RegExpMatchArray | null },
    endwithPosition = false
): RegExpMatchArray | null | undefined {
    const line = endwithPosition
        ? document.lineAt(position).text.substring(0, position.character)
        : document.lineAt(position).text;
    const lineText = line.match(matchRegex);
    if (lineText && lineText.length > 1) {
        return lineText;
    }
}

export function getScriptbyRegex(
    wfScript: any,
    document: TextDocument,
    position: Position,
    matchRegex: { [Symbol.match](string: string): RegExpMatchArray | null },
    endwithPosition = false
): any[] | undefined {
    const lineText = getTextbyRegex(document, position, matchRegex, endwithPosition);
    if (lineText && lineText.length > 1) {
        const scriptId = document.getText(document.getWordRangeAtPosition(position));
        return wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptId);
    }
}
