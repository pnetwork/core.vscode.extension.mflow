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
import { PackTypes, CliCommands } from "./basicCliComands";
import { searchCompletionItems } from "./autoComplete";
import { getWfUri, getWfYaml } from "./path";
import yaml from "js-yaml";
import child from "child_process";
import fs from "fs";
import { getTextbyRegex, getScriptbyRegex, ScriptTypes } from "./util";

/**
 * All Commands
 */
export class TrekCommand extends CliCommands {
    public showVersionCmd(): Disposable {
        return commands.registerCommand("trek.show.version", () => this.getVersion());
    }

    public loginCmd(): Disposable {
        return commands.registerCommand("trek.login", async () => {
            const result = await multiStepInput("Login to Marvin", MultiStepTypes.LOGIN, this);
            if (result && result.isSuc) {
                await this.login(result.name, result.password, result.uri);
            }
        });
    }

    public createProjectCmd(): Disposable {
        return commands.registerCommand("trek.create.project", async () => {
            const result = await multiStepInput("Create Trek project", MultiStepTypes.CREATE_PROJECT, this);
            if (result && result.isSuc) {
                await this.createProject(result.name, result.uri, result.yn.toUpperCase() === "Y");
            }
        });
    }

    public createScriptCmd(scriptType: ScriptTypes): Disposable {
        return commands.registerCommand(`trek.${scriptType}.create`, async () => {
            let result: any;
            const title = `Create ${scriptType} project`;
            if (this.isWfProject) {
                result = await multiStepInput(title, MultiStepTypes.CREATE_SCRIPT_IN_WF, this, scriptType);
            } else {
                result = await multiStepInput(title, MultiStepTypes.CREATE_SCRIPT, this, scriptType);
            }
            if (result && result.isSuc) {
                await this.createScript(
                    scriptType,
                    result.name,
                    result.uri,
                    result.yn.toUpperCase() === "Y",
                    this.isWfProject
                );
            }
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

    public runScriptCmd(scriptType: ScriptTypes): Disposable {
        return commands.registerCommand(`trek.${scriptType}.run`, async () => {
            if (this.matchScriptProject(scriptType)) {
                const result = await multiStepInput("Deploy trek project", MultiStepTypes.RUN_SCRIPT, this);
                if (result && result.isSuc) {
                    this.run(scriptType);
                }
            }
        });
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
                const tp = PackTypes[selection.label as keyof typeof PackTypes];
                await this.buildPush(tp);
            });
        });
    }

    public buildBlcksCmd(): Disposable {
        return commands.registerCommand(`trek.blcks.build`, async () => {
            const scriptType = ScriptTypes.BLCKS;
            if (this.matchScriptProject(scriptType)) {
                await this.buildPush(PackTypes.SCRIPT, scriptType);
            }
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

    public deployScriptCmd(isAuto: boolean, scriptType: ScriptTypes): Disposable {
        const cmd = isAuto ? ".auto" : "";
        return commands.registerCommand(`trek.${scriptType}.deploy` + cmd, async () => {
            if (!this.verifyRootPath()) return;
            if (this.matchScriptProject(scriptType)) {
                const result = await multiStepInput("Deploy trek project", MultiStepTypes.DEPLOY_SCRIPT, this);
                if (result && result.isSuc) {
                    await this.deploy(isAuto, PackTypes.SCRIPT, result.yn.toUpperCase() === "Y", scriptType);
                }
            }
        });
    }

    public packCmd(): Disposable {
        return commands.registerCommand("trek.pack", async () => {
            const items = Object.values(PackTypes).map(label => ({ label }));
            await commands.executeCommand("workbench.action.files.save");
            await createQuickPick(items, async selection => {
                if (!selection) return;
                const tp = PackTypes[selection.label as keyof typeof PackTypes];
                await this.pack(tp);
            });
        });
    }

    public packScriptCmd(scriptType: ScriptTypes): Disposable {
        return commands.registerCommand(`trek.${scriptType}.pack`, async () => {
            if (this.matchScriptProject(scriptType)) {
                await this.pack(PackTypes.SCRIPT, scriptType);
            }
        });
    }

    public viewWf(): Disposable {
        return commands.registerTextEditorCommand("trek.view.wf", editor => {
            if (!this.verifyIsWftemplate(editor.document)) {
                window.showErrorMessage("This file is not workflow file!");
                return;
            }
            if (!this.verifyWfData()) {
                if (!this.wfYaml) this.wfYaml = getWfYaml(this.wfUri || "");
                if (!this.wfScript) this.reloadWfScript();
                if (this.verifyWfData()) {
                    window.showErrorMessage("Workflow file is invalid!");
                    return;
                }
            }
            const title = this.wfUri ? path.basename(this.wfUri) : "graph.yml";
            const panel = window.createWebviewPanel("wfGraph", title, ViewColumn.One);
            panel.webview.html = this.buildWfGraphWebView(panel);
        });
    }

    public verifyIsEntryJsonOrWfFile(document: TextDocument): boolean {
        const lang = document.languageId;
        if (lang === "json") {
            if (document.fileName !== path.join(this.rootPath, "manifest.json")) return false;
            return true;
        }
        return this.verifyIsWftemplate(document);
    }

    public reloadWfYamlbyWfUri(document: TextDocument): boolean {
        const lang = document.languageId;
        if (lang === "json") {
            const wfUriNew = getWfUri(this.rootPath);
            this.wfUri = wfUriNew || this.wfUri;
            return true;
        } else {
            if (!this.wfUri) this.wfUri = getWfUri(this.rootPath);
            if (!this.wfUri) return false;
            const wfYamlNew = getWfYaml(this.wfUri);
            this.wfYaml = wfYamlNew || this.wfYaml;
            if (!wfYamlNew) return false;
            const stdout = child.execFileSync(`${this.trekPath}`, ["showscripts"], { cwd: this.rootPath });
            if (!stdout) return false;
            this.wfScript = yaml.safeLoad(stdout.toString());
            return true;
        }
    }

    public autoCompleteItems(): Disposable {
        return languages.registerCompletionItemProvider(
            { scheme: "file", language: "yaml" },
            {
                provideCompletionItems: async (document, position) => {
                    if (!this.verifyIsWftemplate(document) || !this.isWfProject) return;
                    if (!this.verifyWfData()) {
                        await commands.executeCommand("workbench.action.files.save");
                        if (!this.reloadWfYamlbyWfUri(document)) return;
                    }
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
                    if (!this.verifyIsWftemplate(document) || !this.isWfProject) return;
                    if (!this.verifyWfData()) {
                        await commands.executeCommand("workbench.action.files.save");
                        if (!this.reloadWfYamlbyWfUri(document)) return;
                    }
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
                    if (!this.verifyIsWftemplate(document) || !this.isWfProject) return;
                    if (!this.verifyWfData()) {
                        await commands.executeCommand("workbench.action.files.save");
                        if (!this.reloadWfYamlbyWfUri(document)) return;
                    }
                    if (!this.wfYaml?.graph?.nodes) return;
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
