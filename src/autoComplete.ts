import vscode from "vscode";
import yaml from "js-yaml";
import path from "path";
import fs from "fs";
import { getConfig, getGlobalConfig } from "./path";

/**
 * The absctract auto complete class.
 * Define members who needed in event/script auto comlate.
 */
abstract class AutoComplete {
    config: any;
    gbConfig: any;
    constructor(public rootPath: string, public wfYaml: any, public wfUri: string) {
        this.rootPath = rootPath;
        this.wfYaml = wfYaml;
        this.wfUri = wfUri;
        this.config = getConfig(this.rootPath);
        this.gbConfig = getGlobalConfig();
    }

    protected abstract getSchemaYaml(nodeId: string): any;
    /**
     * Get auto complete options.
     * @param nodeId: the node id from wf template graph.yaml.
     * @param lineTexts: the keying text split by `.`, i.e. [results, 0, fail]
     */
    public abstract async getCompletionItems(nodeId: string, lineTexts: string[]): Promise<vscode.CompletionItem[]>;
}

/**
 * Script auto Complete
 */
export class ScriptAutoComplete extends AutoComplete {
    constructor(public rootPath: string, public wfYaml: any, public wfUri: string, public wfScript: any) {
        super(rootPath, wfYaml, wfUri);
        this.wfScript = wfScript;
    }

    /**
     * Get the script schema para.
     * @param nodeId: the node id from wf template graph.yaml.
     */
    protected getSchemaYaml(nodeId: string): any {
        const scriptMeta = this.wfYaml.graph.nodes.find((i: { id: string }) => i.id === nodeId);
        if (scriptMeta && scriptMeta.metadata && scriptMeta.metadata.script) {
            const scriptId = scriptMeta.metadata.script.id;
            if (!scriptId) throw Error("has no script id");
            const script = this.wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptId);
            if (script.length < 1) throw Error("has no script id");
            return yaml.safeLoad(fs.readFileSync(script[0].scriptSchemaPath, "utf8"));
        }
        return undefined;
    }

    public async getCompletionItems(nodeId: string, lineTexts: string[]): Promise<vscode.CompletionItem[]> {
        const schemaYaml = this.getSchemaYaml(nodeId);
        if (!schemaYaml) {
            throw Error(`scriptId cannot find.`);
        }

        let options = schemaYaml.outputs;
        let isArray = false;
        for (const i in lineTexts) {
            if (isArray) {
                isArray = false;
                if (lineTexts[i].match(/\d/)) {
                    options = options.items;
                } else {
                    options = [];
                }
            } else {
                options = options ? options[lineTexts[i]] : [];
            }
            switch (options && options.type) {
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

/**
 * Event auto Complete
 */
export class EventAutoComplete extends AutoComplete {
    /**
     * Get the Event schema para.
     * @param nodeId: the node id from wf template graph.yaml.
     */
    protected getSchemaYaml(): any {
        let eventPath = this.config.input_event_path ? this.config.input_event_path : this.gbConfig.input_event_path;
        if (eventPath) {
            eventPath = path.join(this.rootPath, eventPath);
            return yaml.safeLoad(fs.readFileSync(eventPath, "utf8"));
        }
        return undefined;
    }

    public async getCompletionItems(nodeId: string, lineTexts: string[]): Promise<vscode.CompletionItem[]> {
        const eventYaml = this.getSchemaYaml();
        if (!eventYaml) {
            return [new vscode.CompletionItem("")];
        }
        let options = eventYaml;
        let isArray = false;
        for (const i in lineTexts) {
            if (isArray) {
                isArray = false;
                if (lineTexts[i].match(/\d/) && (options[0] instanceof Object || Array.isArray(options[0]))) {
                    options = options[0];
                } else {
                    options = [];
                }
            } else {
                options = options ? options[lineTexts[i]] : [];
            }
            if (Array.isArray(options)) {
                isArray = true;
                if (Number(i) === lineTexts.length - 1) {
                    options = [];
                }
            }
        }
        const dependencies = Object.keys(options || {});
        return dependencies.map(dep => {
            return new vscode.CompletionItem(dep, vscode.CompletionItemKind.Field);
        });
    }
}

/**
 * Get script output column by typing value
 * @param document: workflow templaye graph content.
 * @param position: trigger position in document.
 * @param rootPath: workspeace root.
 * @param wfYaml: the newest saved workflow templaye yaml.
 * @param wfUri: the newest saved workflow templaye yaml uri.
 */
export async function autoComplete(
    document: vscode.TextDocument,
    position: vscode.Position,
    rootPath: string,
    wfYaml: any,
    wfUri: string,
    wfScript: any
): Promise<vscode.CompletionItem[]> {
    if (document.fileName !== wfUri) {
        return [new vscode.CompletionItem("")];
    }
    const line = document.lineAt(position).text.substring(0, position.character);
    const lineText = line.match(/(\d)\.([^\s]+\.)?/);
    if (lineText && lineText.length > 1 && wfYaml && wfYaml.graph) {
        let autoComplete: AutoComplete;
        const lineTexts =
            lineText.length > 2 && lineText[2]
                ? lineText[2]
                      .replace(/(\[)+(\d)(\])+/g, ".$2.")
                      .replace("[]", ".0.")
                      .split(".")
                      .filter(x => x)
                : [];
        if (lineText[1] === "0") {
            autoComplete = new EventAutoComplete(rootPath, wfYaml, wfUri);
        } else {
            autoComplete = new ScriptAutoComplete(rootPath, wfYaml, wfUri, wfScript);
        }
        return autoComplete.getCompletionItems(lineText[1], lineTexts);
    }
    return [new vscode.CompletionItem("")];
}
