import { TextDocument, Position } from "vscode";
import path from "path";
import fs from "fs";
import { getConfig, getRootPath, getGlobalConfig } from "./path";
import glob from "glob";

/**
 * Script type.
 */
export enum ScriptTypes {
    BLCKS = "blcks",
    ANSIBLE = "ansible",
    SHELL = "shell",
    TERRAFORM = "terraform"
}

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

/**
 * Check workspace is workspace project or not.
 * @param projectPath: Project path.
 */
export function isWorkflowProject(projectPath: string): boolean {
    const trekPath = path.join(projectPath, ".trek/");
    const packagesPath = path.join(projectPath, "packages.json");
    const manifestPath = path.join(projectPath, "manifest.json");
    if (fs.existsSync(trekPath) && fs.existsSync(packagesPath) && fs.existsSync(manifestPath)) {
        return true;
    }
    return false;
}

/**
 * Check workspace is blcks project or not.
 * @param projectPath: Project path.
 */
export function isBlcksProject(rootPath: string): boolean {
    const trekPath = path.join(rootPath, ".trek/");
    const openfaasFile = path.join(rootPath, "openfaas.yml");
    if (fs.existsSync(trekPath) && fs.existsSync(openfaasFile)) {
        return true;
    }
    return false;
}

function findPara(rootPath: string): string | undefined {
    const file = glob.sync("**/*.para", { cwd: rootPath });
    if (file && file.length > 0) {
        return file[0];
    }
}

/**
 * Check workspace is terraform project or not.
 * @param projectPath: Project path.
 */
export function isTerraformProject(rootPath: string): boolean {
    const trekPath = path.join(rootPath, ".trek/");
    const file = glob.sync("*.tf", { cwd: rootPath });
    if (fs.existsSync(trekPath) && file && file.length > 0) {
        return true;
    }
    return false;
}

/**
 * Check workspace is ansible project or not.
 * @param projectPath: Project path.
 */
export function isAnsibleProject(rootPath: string): boolean {
    const trekPath = path.join(rootPath, ".trek/");
    const filename = findPara(rootPath);
    if (filename) {
        const name = path.basename(filename, ".para");
        const openfaasFile = path.join(rootPath, `${name}.yml`);
        if (fs.existsSync(trekPath) && fs.existsSync(openfaasFile)) {
            return true;
        }
    }
    return false;
}

/**
 * Check workspace is shell project or not.
 * @param projectPath: Project path.
 */
export function isShellProject(rootPath: string): boolean {
    const trekPath = path.join(rootPath, ".trek/");
    const filename = findPara(rootPath);
    if (filename) {
        const name = path.basename(filename, ".para");
        const openfaasFile = path.join(rootPath, `${name}.sh`);
        if (fs.existsSync(trekPath) && fs.existsSync(openfaasFile)) {
            return true;
        }
    }
    return false;
}

/**
 * Get config property from project -> global config.json.
 * @param property: The config property name
 */
export function getConfigProperty(property: string): any {
    const rootPath = getRootPath();
    let val;
    if (isBlcksProject(rootPath)) {
        val = getConfig(rootPath)[property];
    }
    if (!val && isWorkflowProject(rootPath)) {
        val = getConfig(rootPath)[property];
    }
    if (!val) {
        val = getGlobalConfig()[property];
    }
    return val;
}
