import {
    window,
    ViewColumn,
    commands,
    Disposable,
    languages,
    TextDocument,
    Location,
    Uri,
    Position,
    Hover
} from "vscode";
import path from "path";
import { createInputBox, createQuickPick, execCommandCallback } from "./basicInput";
import { multiStepInput, MultiStepTypes } from "./multiStep";
import { ScriptTypes, PackTypes, CliCommands } from "./basicCliComands";
import { searchCompletionItems } from "./autoComplete";
import { getWfUri, getWfYaml } from "./path";
import yaml from "js-yaml";
import child from "child_process";
import fs from "fs";
import { getTextbyRegex, getScriptbyRegex } from "./util";

/**
 * All Commands
 */
export class TrekCommand extends CliCommands {
    readonly scriptNameReg = new RegExp("^[a-z0-9]+$");

    public showVersionCmd(): Disposable {
        return commands.registerCommand("trek.show.version", () => this.getVersion());
    }

    public loginCmd(): Disposable {
        return commands.registerCommand("trek.login", async () => {
            const result = await multiStepInput("Login to Marvin", MultiStepTypes.LOGIN);
            if (result && result.isSuc) {
                await this.login(result.name, result.password, result.uri);
            }
        });
    }

    public createProjectCmd(): Disposable {
        return commands.registerCommand("trek.create.project", async () => {
            const result = await multiStepInput("Create Trek project", MultiStepTypes.CREATE_PROJECT);
            if (result && result.isSuc) {
                await this.createProject(result.name, result.uri, result.yn.toUpperCase() === "Y");
            }
        });
    }

    public createScriptCmd(scriptType: ScriptTypes): Disposable {
        return commands.registerCommand(`trek.${scriptType}.create`, async () => {
            const name = await createInputBox(`Please enter ${scriptType} name: `, undefined, text => {
                if (!this.scriptNameReg.test(text)) {
                    return "Script name should be number(0-9) or lowercase letter(a-z).";
                }
            });
            if (!name) return;
            await this.createScript(scriptType, name);
        });
    }

    public installScriptCmd(): Disposable {
        return commands.registerCommand("trek.install.script", async () => {
            const scriptId = await createInputBox(
                "Please enter script id: ",
                "notification or notification==0.5.0 or *"
            );
            if (!scriptId) {
                return;
            }
            this.installScript(scriptId);
        });
    }

    public showInstalledScriptCmd(): Disposable {
        return commands.registerCommand("trek.show.installed", () => {
            this.getInstalledScript();
        });
    }

    public uninstallScriptCmd(): Disposable {
        return commands.registerCommand("trek.uninstall.script", async () => {
            const scriptId = await createInputBox("Please enter script id: ", "notification");
            if (!scriptId) return;
            this.uninstallScript(scriptId);
        });
    }

    public remoteScriptCmd(): Disposable {
        return commands.registerCommand("trek.remote.scripts", async () => {
            const scriptId = await createInputBox("Please enter script id: ", "notification or *");
            if (!scriptId) return;
            this.remoteScript(scriptId);
        });
    }

    public upCmd(): Disposable {
        return commands.registerCommand("trek.up", () => this.up());
    }

    public runCmd(): Disposable {
        return commands.registerCommand("trek.run", () => this.run());
    }

    public downCmd(): Disposable {
        return commands.registerCommand("trek.down", () => this.down());
    }

    public logsCmd(): Disposable {
        return commands.registerCommand("trek.show.logs", async () => {
            const scriptId = await createInputBox("Please enter script id: ", "notification or *");
            if (!scriptId) return;
            this.logs(scriptId);
        });
    }

    public buildCmd(): Disposable {
        return commands.registerCommand("trek.build", async () => {
            const items = Object.values(PackTypes)
                .filter(x => x !== PackTypes.WORKFLOW)
                .map(label => ({ label }));
            await commands.executeCommand("workbench.action.files.save");
            await createQuickPick(items, async selection => {
                if (!selection) return;
                await this.buildPush(selection);
            });
        });
    }

    public deployCmd(isAuto: boolean): Disposable {
        return commands.registerCommand(isAuto ? "trek.deploy.auto" : "trek.deploy", async () => {
            if (!this.verifyRootPath()) return;
            const result = await multiStepInput("Deploy trek project", MultiStepTypes.DEPLOY, this);
            if (result && result.isSuc) {
                await this.deploy(isAuto, result.type, result.yn.toUpperCase() === "Y", result.scriptType, result.uri);
            }
        });
    }

    public packCmd(): Disposable {
        return commands.registerCommand("trek.pack", async () => {
            const items = Object.values(PackTypes).map(label => ({ label }));
            await commands.executeCommand("workbench.action.files.save");
            await createQuickPick(items, async selection => {
                if (!selection) return;
                await this.pack(selection);
            });
        });
    }

    public viewWf(): Disposable {
        return commands.registerTextEditorCommand("trek.view.wf", editor => {
            if (!this.verifyIsWftemplate(editor.document)) {
                window.showErrorMessage("This file is not workflow file!");
                return;
            }
            const title = this.wfUri ? path.basename(this.wfUri) : "graph.yml";
            const panel = window.createWebviewPanel("wfGraph", title, ViewColumn.One);
            panel.webview.html = this.buildWfGraphWebView(panel);
        });
    }

    public reloadWfYamlbyWfUri(document: TextDocument): Record<string, any> | undefined {
        const lang = document.languageId;
        if (!(this.rootPath && document.uri.scheme === "file" && (lang === "json" || lang === "yaml"))) return;
        if (lang === "json") {
            if (document.fileName !== path.join(this.rootPath, "manifest.json")) return;
            const wfUriNew = getWfUri(this.rootPath);
            this.wfUri = wfUriNew || this.wfUri;
        } else {
            if (!this.verifyIsWftemplate(document)) return;
            const wfYamlNew = getWfYaml(this.wfUri || "");
            this.wfYaml = wfYamlNew || this.wfYaml;
            if (!wfYamlNew) return;
            const openFile = execCommandCallback(stdout => {
                if (!stdout) return;
                this.wfScript = yaml.safeLoad(stdout.toString());
            });
            child.execFile(`${this.trekPath}`, ["showscripts"], { cwd: this.rootPath }, openFile);
        }
    }

    public autoCompleteItems(): Disposable {
        return languages.registerCompletionItemProvider(
            { scheme: "file", language: "yaml" },
            {
                provideCompletionItems: async (document, position) => {
                    if (!this.verifyIsWftemplate(document)) return;
                    await commands.executeCommand("workbench.action.files.save");
                    return searchCompletionItems(
                        this.rootPath,
                        this.wfYaml,
                        this.wfScript,
                        this.output,
                        document,
                        position
                    );
                }
            },
            "."
        );
    }

    public jumptoDefination(): Disposable {
        return languages.registerDefinitionProvider(
            { scheme: "file", language: "yaml" },
            {
                provideDefinition: async (document, position) => {
                    if (!this.verifyIsWftemplate(document)) return;
                    await commands.executeCommand("workbench.action.files.save");
                    const script = getScriptbyRegex(this.wfScript, document, position, /id:\s+'?()'?/);
                    if (script) return new Location(Uri.file(script[0].scriptSchemaPath), new Position(0, 0));
                }
            }
        );
    }

    private nodeScriptTooltip(document: TextDocument, position: Position): Hover | undefined {
        const script = getScriptbyRegex(this.wfScript, document, position, /id:\s+'?(.*)'?/);
        if (script) {
            const y = yaml.safeLoad(fs.readFileSync(script[0].scriptSchemaPath, "utf8"));
            return new Hover(
                `    (${script[0].scriptType}) ${y.id}: ${y.name} \n --- \n${y.description ? y.description : ""}`
            );
        }
    }

    private edgesTooltip(document: TextDocument, position: Position): Hover | undefined {
        const lineText = getTextbyRegex(document, position, /(source|target):\s+'?(\d+)'?/);
        if (!(lineText && lineText.length > 2)) return;

        const scriptMeta = this.wfYaml.graph.nodes.find((i: { id: string }) => i.id === lineText[2]);
        if (!(scriptMeta && scriptMeta.metadata)) return;
        if (scriptMeta.metadata.type === "trigger") {
            return new Hover("    trigger node");
        } else if (scriptMeta.metadata.type === "terminator") {
            return new Hover("    terminator node");
        } else if (scriptMeta.metadata.type === "selector") {
            return new Hover("    selector node");
        }
        const script = this.wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptMeta.metadata.script?.id);
        if (!script) return;

        const y = yaml.safeLoad(fs.readFileSync(script[0].scriptSchemaPath, "utf8"));
        let str = lineText[1] === "source" ? "[Outputs:]" : "[Inputs:]";
        str += `(${script[0].scriptSchemaPath}) \n`;
        const paramType = lineText[1] === "source" ? "outputs" : "inputs";
        const outputs = y[paramType];
        Object.keys(outputs).forEach((i: any) => {
            const desc = outputs[i].title || outputs[i].description || "";
            str += `\n     (${outputs[i].type || "None"}) ${i}: ${desc}`;
        });
        return new Hover(
            `    (${script[0].scriptType}) ${y.id}: ${y.name} \n --- \n${y.description ? y.description : ""}\n\n ${str}`
        );
    }

    private propertyTooltip(document: TextDocument, position: Position): Hover | undefined {
        let lineText = getTextbyRegex(document, position, /(\d)\.([^\s]+)?/);
        let propertyText: string;
        let nodeId: string | undefined;
        let inputOutput: string;
        if (lineText && lineText.length > 2) {
            nodeId = lineText[1];
            propertyText = lineText[2];
            inputOutput = "outputs";
        } else {
            lineText = getTextbyRegex(document, position, /property:\s+'?(.+)'?/);
            if (!(lineText && lineText.length > 1)) return;
            let i = position.line;
            for (i; i > 0; i--) {
                const lineText = document.lineAt(i).text;
                const line = lineText.match(/target:\s+'?(\d+)'?/);
                if (line && line.length > 1) {
                    nodeId = line[1];
                    break;
                }
            }
            if (!nodeId) return;
            propertyText = lineText[1];
            inputOutput = "inputs";
        }

        const scriptMeta = this.wfYaml.graph.nodes.find((i: { id: string }) => i.id === nodeId);
        if (!(scriptMeta && scriptMeta.metadata && scriptMeta.metadata.type !== "trigger")) return;
        const script = this.wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptMeta.metadata.script?.id);
        if (!script) return;
        const y = yaml.safeLoad(fs.readFileSync(script[0].scriptSchemaPath, "utf8"));
        const propertyTexts = propertyText
            .replace(/\[\d\]|\.\d|\[\]/g, "")
            .split(".")
            .filter(x => x);

        let property: any;
        for (const i of propertyTexts) {
            if (property) {
                if (property.properties) {
                    property = property.properties[i];
                } else if (property.items?.properties) {
                    property = property.items.properties[i];
                }
            } else {
                property = y[inputOutput][i];
            }
        }

        const name = property.name || property.title || "";
        const desc = property.description || "";
        return new Hover(`    (${property.type || "None"}) ${propertyText}: ${name} \n ${desc}`);
    }

    public hoverTooltips(): Disposable {
        return languages.registerHoverProvider(
            { scheme: "file", language: "yaml" },
            {
                provideHover: async (document, position) => {
                    if (!this.verifyIsWftemplate(document)) return;
                    if (!this.wfYaml?.graph?.nodes) return;
                    await commands.executeCommand("workbench.action.files.save");
                    let tooltip = this.nodeScriptTooltip(document, position);
                    if (tooltip) {
                        return tooltip;
                    }
                    tooltip = this.edgesTooltip(document, position);
                    if (tooltip) {
                        return tooltip;
                    }
                    return this.propertyTooltip(document, position);
                }
            }
        );
    }
}
