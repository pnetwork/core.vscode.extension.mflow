import * as vscode from "vscode";
import * as yaml from "js-yaml";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as glob from "glob";

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
 * Load workflow template graph.
 * @param rootPath: workspeace root.
 * @param document: workflow templaye graph content.
 */
export function getWfGraph(rootPath: string, document: vscode.TextDocument): any | undefined {
    const wfUri = getWfUri(rootPath);
    if (wfUri) {
        if (document.languageId === "yaml" && document.uri.scheme === "file" && document.fileName === wfUri) {
            try {
                return yaml.safeLoad(fs.readFileSync(wfUri, "utf8"));
            } catch (e) {
                return undefined;
            }
        }
    }
}

/**
 * Find script schema para from: workspace, mflow config base folder setting.
 * @param scriptId: script id.
 * @param rootPath: workspeace root.
 */
async function findScriptSchema(scriptId: string, rootPath: string): Promise<any> {
    let files: any = await vscode.workspace.findFiles("**/" + scriptId + ".para");
    if (files && files.length > 0) {
        return yaml.safeLoad(fs.readFileSync(files[0].path, "utf8"));
    }

    const config = yaml.safeLoad(fs.readFileSync(path.join(rootPath, ".mflow", "config.json"), "utf8"), {
        schema: yaml.JSON_SCHEMA
    });
    const gbConfig = yaml.safeLoad(fs.readFileSync(path.join(os.homedir(), ".mflow", "config.json"), "utf8"), {
        schema: yaml.JSON_SCHEMA
    });
    const blcksBase = config.blcks_code_base ? config.blcks_code_base : gbConfig.blcks_code_base;
    const ansibleBase = config.ansible_code_base ? config.ansible_code_base : gbConfig.ansible_code_base;
    const shellBase = config.shell_script_base ? config.shell_script_base : gbConfig.shell_script_base;
    const ansibleFolder = ansibleBase ? "," + ansibleBase : "";
    const shellFolder = shellBase ? "," + shellBase : "";
    const pattern = `{${blcksBase}${ansibleFolder}${shellFolder})}*/${scriptId}.para`;
    files = glob.sync(pattern);
    if (files && files.length > 0) {
        return yaml.safeLoad(fs.readFileSync(files[0], "utf8"));
    }
}

/**
 * Get script output column
 * @param document: workflow templaye graph content.
 * @param position: trigger position in document.
 * @param rootPath: workspeace root.
 * @param wfYaml: the newest saved workflow templaye yaml.
 * @param wfUri: the newest saved workflow templaye yaml uri.
 */
export async function scriptAutoComplete(
    document: vscode.TextDocument,
    position: vscode.Position,
    rootPath: string,
    wfYaml: any,
    wfUri: string
): Promise<vscode.CompletionItem[]> {
    if (document.fileName !== wfUri) {
        return [new vscode.CompletionItem("")];
    }
    const line = document.lineAt(position).text.substring(0, position.character);
    const lineText = line.match(/{{\s*(\d)\.([^\s]+\.)?/);
    if (lineText && lineText.length > 1 && wfYaml && wfYaml.graph) {
        const scriptMeta = wfYaml.graph.nodes.find((i: { id: string }) => i.id === lineText[1]);
        const lineTexts =
            lineText.length > 2 && lineText[2]
                ? lineText[2]
                      .replace(/(\[)+(\d)(\])+/g, ".$2.")
                      .split(".")
                      .filter(x => x)
                : [];
        if (scriptMeta && scriptMeta.metadata && scriptMeta.metadata.script) {
            const scriptId = scriptMeta.metadata.script.id;
            if (!scriptId) {
                throw Error("has no script id");
            }

            const schemaYaml = await findScriptSchema(scriptId, rootPath);
            if (!schemaYaml) {
                throw Error(`scriptId ${scriptId} cannot find.`);
            }

            let options = schemaYaml.outputs;
            let isArray = false;
            for (const i in lineTexts) {
                if (isArray) {
                    if (lineTexts[i].match(/\d/)) {
                        options = options.items;
                    } else {
                        options = [];
                    }
                } else {
                    options = options[lineTexts[i]];
                }
                switch (options.type) {
                    case "object": {
                        options = options.properties;
                        break;
                    }
                    case "array": {
                        isArray = true;
                        if (Number(i) === lineTexts.length - 1) {
                            options = [];
                        }
                        break;
                    }
                    default: {
                        options = [];
                        break;
                    }
                }
            }

            const dependencies = Object.keys(options || {});
            return dependencies.map(dep => {
                return new vscode.CompletionItem(dep, vscode.CompletionItemKind.Field);
            });
        }
    }
    return [new vscode.CompletionItem("")];
}
