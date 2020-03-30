import path from "path";
import yaml from "js-yaml";
import fs from "fs";
import os from "os";
import { workspace } from "vscode";

/**
 * Get file url of workflow graph yaml
 * @param rootPath: workspeace root.
 */
export function getWfUri(rootPath: string): string | undefined {
    const manifestFileName = path.join(rootPath, "manifest.json");
    if (!fs.existsSync(manifestFileName)) {
        return;
    }
    const manifestFS = fs.readFileSync(manifestFileName, "utf8");
    const manifest = yaml.safeLoad(manifestFS, { schema: yaml.JSON_SCHEMA });
    let wfUri = manifest.entry ? manifest.entry : "";
    if (wfUri) {
        wfUri = path.join(rootPath, wfUri);
    }
    return wfUri;
}

/**
 * Get workflow graph yaml
 * @param wfUri: workspeace file url.
 */
export function getWfYaml(wfUri: string): string | undefined {
    let wfYaml: any;
    if (!wfUri) return;
    try {
        wfYaml = yaml.safeLoad(fs.readFileSync(wfUri, "utf8"));
    } catch (e) {
        // return undefined;
    }
    return wfYaml;
}

/**
 * Get mflow project config json
 * @param rootPath: the workspece path.
 */
export function getConfig(rootPath: string): any {
    if (!rootPath) return;
    const projectConfigPath = path.join(rootPath, ".mflow", "config.json");
    if (!fs.existsSync(projectConfigPath)) {
        return;
    }
    return yaml.safeLoad(fs.readFileSync(projectConfigPath, "utf8"), {
        schema: yaml.JSON_SCHEMA
    });
}

/**
 * Get mflow global config json
 */
export function getGlobalConfig(): any {
    const globalConfigPath = path.join(os.homedir(), ".mflow", "config.json");
    if (!fs.existsSync(globalConfigPath)) {
        return;
    }
    return yaml.safeLoad(fs.readFileSync(path.join(os.homedir(), ".mflow", "config.json"), "utf8"), {
        schema: yaml.JSON_SCHEMA
    });
}

/**
 * Get MFlow path from setting
 */
export function getMFlowPath(): string {
    let mflowPath = workspace.getConfiguration().get<string>("mflow.path");
    if (!mflowPath) {
        mflowPath = "mflow";
    }
    return mflowPath;
}
