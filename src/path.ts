import path from "path";
import yaml from "js-yaml";
import fs from "fs";
import os from "os";

/**
 * Get file url of workflow graph yaml
 * @param rootPath: workspeace root.
 */
export function getWfUri(rootPath: string): string {
    const manifestFileName = path.join(rootPath, "manifest.json");
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
export function getWfYaml(wfUri: string): string {
    let wfYaml = "";
    if (wfUri) {
        try {
            wfYaml = yaml.safeLoad(fs.readFileSync(wfUri, "utf8"));
        } catch (e) {
            // return undefined;
        }
    }
    return wfYaml;
}

/**
 * Get mflow project config json
 * @param rootPath: the workspece path.
 */
export function getConfig(rootPath: string): any {
    return yaml.safeLoad(fs.readFileSync(path.join(rootPath, ".mflow", "config.json"), "utf8"), {
        schema: yaml.JSON_SCHEMA
    });
}

/**
 * Get mflow global config json
 */
export function getGlobalConfig(): any {
    return yaml.safeLoad(fs.readFileSync(path.join(os.homedir(), ".mflow", "config.json"), "utf8"), {
        schema: yaml.JSON_SCHEMA
    });
}

export function getConfScriptPathPattern(rootPath: string, scriptIds: string[]): string {
    const config = getConfig(rootPath);
    const gbConfig = getGlobalConfig();
    const basePath: string[] = [];
    let x = config.blcks_code_base || gbConfig.blcks_code_base;
    if (x) basePath.push(x + "*");
    x = config.ansible_code_base || gbConfig.ansible_code_base;
    if (x) basePath.push(x + "*/schema");
    x = config.shell_script_base || gbConfig.shell_script_base;
    if (x) basePath.push(x + "*");
    const scriptPath = basePath.join(",");
    const sciprtPattern = scriptIds.length > 1 ? "{" + scriptIds.toString().toLowerCase() + "}" : scriptIds;
    const pattern = `{${scriptPath}}/${sciprtPattern}.para`;

    return pattern;
}
