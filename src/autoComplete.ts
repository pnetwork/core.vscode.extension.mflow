import { OutputChannel, CompletionItem, CompletionItemKind, TextDocument, Position } from "vscode";
import yaml from "js-yaml";
import path from "path";
import fs from "fs";
import { getConfig, getGlobalConfig } from "./path";
import { getTextbyRegex } from "./util";

export class MCompletionItem extends CompletionItem {
    filterText = ".";
    kind = CompletionItemKind.Field;
}

/**
 * The absctract auto complete class.
 * Define members who needed in event/script auto comlate.
 */
abstract class AutoComplete {
    config: any;
    gbConfig: any;
    constructor(public rootPath: string, public wfYaml: any, public ouput: OutputChannel) {
        this.config = getConfig(this.rootPath);
        this.gbConfig = getGlobalConfig();
    }

    protected abstract getSchemaYaml(nodeId?: string): any;
    /**
     * Get auto complete options.
     * @param nodeId: the node id from wf template graph.yaml.
     * @param lineTexts: the keying text split by `.`, i.e. [results, 0, fail]
     */
    public abstract async getCompletionItems(nodeId: string, lineTexts: string[]): Promise<MCompletionItem[]>;
}

/**
 * Script auto Complete
 */
export class ScriptAutoComplete extends AutoComplete {
    constructor(public rootPath: string, public wfYaml: any, public wfScript: any, public ouput: OutputChannel) {
        super(rootPath, wfYaml, ouput);
        this.wfScript = wfScript;
    }

    /**
     * Get the script schema para.
     * @param nodeId: the node id from wf template graph.yaml.
     */
    protected getSchemaYaml(nodeId: string): any {
        if (!this.wfYaml.graph.nodes) return;
        const scriptMeta = this.wfYaml.graph.nodes.find((i: { id: string }) => i.id === nodeId);
        this.ouput.appendLine(`Script auto complete: node id(${nodeId}).`);
        if (scriptMeta && scriptMeta.metadata && scriptMeta.metadata.script) {
            const scriptId = scriptMeta.metadata.script.id;
            if (!scriptId) throw Error("has no script id");
            const script = this.wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptId);
            if (script.length < 1) throw Error("has no script id");
            this.ouput.appendLine(`Script auto complete: script id(${scriptId}).`);
            if (!fs.existsSync(script[0].scriptSchemaPath)) return;
            return yaml.safeLoad(fs.readFileSync(script[0].scriptSchemaPath, "utf8"));
        }
    }

    public async getCompletionItems(nodeId: string, lineTexts: string[]): Promise<MCompletionItem[]> {
        const schemaYaml = this.getSchemaYaml(nodeId);
        if (!schemaYaml) throw Error(`scriptId cannot find.`);
        this.ouput.appendLine(`Script auto complete schema loaded success.`);

        let options = schemaYaml.outputs;
        let isArray = false;
        for (const i in lineTexts) {
            if (isArray) {
                isArray = false;
                options = !lineTexts[i].match(/\d/) ? options.items : {};
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
                    if (Number(i) === lineTexts.length - 1) options = {};
                    break;
                }
                default: {
                    options = {};
                    break;
                }
            }
        }
        const dependencies = Object.keys(options || {});
        return dependencies.map(val => {
            const item = new MCompletionItem(val);
            const name = options[val].name || options[val].title || "";
            const desc = options[val].description || "";
            item.detail = `(${options[val].type || "None"}) ${val}: ${name}`;
            item.documentation = `${desc}`;
            return item;
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
        if (!eventPath) return;
        this.ouput.appendLine(`Event auto complete: event path is ${eventPath}.`);
        eventPath = path.join(this.rootPath, eventPath);
        if (!fs.existsSync(eventPath)) return;
        return yaml.safeLoad(fs.readFileSync(eventPath, "utf8"));
    }

    public async getCompletionItems(nodeId: string, lineTexts: string[]): Promise<MCompletionItem[]> {
        const eventYaml = this.getSchemaYaml();
        if (!eventYaml) return [new MCompletionItem("")];

        this.ouput.appendLine(`Event auto complete schema loaded success.`);
        let options = eventYaml;
        let isArray = false;
        for (const i in lineTexts) {
            if (isArray) {
                isArray = false;
                if (lineTexts[i].match(/\d/) && (options[0] instanceof Object || Array.isArray(options[0]))) {
                    options = options[0];
                } else {
                    options = {};
                }
            } else {
                options = options ? options[lineTexts[i]] : {};
            }
            if (Array.isArray(options)) {
                isArray = true;
                if (Number(i) === lineTexts.length - 1) {
                    options = {};
                }
            }
        }
        const dependencies = Object.keys(options || {});
        return dependencies.map(dep => new MCompletionItem(dep));
    }
}

/**
 * Get script output column by typing value
 * @param rootPath: workspeace root.
 * @param wfYaml: the newest saved workflow templaye yaml.
 * @param wfScript: the newest saved script info from workflow templaye.
 * @param ouput: The Trek output channel.
 * @param document: workflow templaye graph content.
 * @param position: trigger position in document.
 */
export async function searchCompletionItems(
    rootPath: string,
    wfYaml: any,
    wfScript: any,
    ouput: OutputChannel,
    document: TextDocument,
    position: Position
): Promise<CompletionItem[]> {
    let result = [new CompletionItem("")];
    const lineText = getTextbyRegex(document, position, /(\d)\.([^\s]+\.)?/, true);
    if (!(lineText && lineText.length > 1 && wfYaml?.graph?.nodes)) return result;

    let autoComplete: AutoComplete;
    let lineTexts: string[] = [];
    if (lineText.length > 2 && lineText[2]) {
        lineTexts = lineText[2]
            .replace(/(\[)+(\d)(\])+/g, ".$2.")
            .replace("[]", ".0.")
            .split(".")
            .filter(x => x);
    }

    const scriptMeta = wfYaml.graph.nodes.find((i: { id: string }) => i.id === lineText[1]);
    if (scriptMeta.metadata.type === "trigger") {
        autoComplete = new EventAutoComplete(rootPath, wfYaml, ouput);
    } else {
        autoComplete = new ScriptAutoComplete(rootPath, wfYaml, wfScript, ouput);
    }
    try {
        result = await autoComplete.getCompletionItems(lineText[1], lineTexts);
        // Position of the selected auto-complete item insert.
        const range = document.getWordRangeAtPosition(position);
        if (range) {
            result.forEach((item: any) => (item.range = range.with(position, position)));
        }
    } catch (e) {
        console.log(e);
    }
    return result;
}
