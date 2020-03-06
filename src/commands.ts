import { window, ViewColumn, commands, Disposable, languages, TextDocument, CompletionItem } from "vscode";
import path from "path";
import { createInputBox, createQuickPick, execCommandCallback } from "./basicInput";
import { multiStepInput, MultiStepTypes } from "./multiStep";
import { ScriptTypes, PackTypes, CliCommands } from "./basicCliComands";
import { autoComplete } from "./autoComplete";
import { getWfUri, getWfYaml } from "./path";
import yaml from "js-yaml";
import child from "child_process";

/**
 * All Commands
 */
export class MflowCommand extends CliCommands {
    readonly scriptNameReg = new RegExp("^[a-z0-9]+$");

    public showVersionCmd(): Disposable {
        return commands.registerCommand("mflow.show.version", () => this.getVersion());
    }

    public createProjectCmd(): Disposable {
        return commands.registerCommand("mflow.create.project", async () => {
            const result = await multiStepInput("Create mflow project", MultiStepTypes.CREATE_PROJECT);
            if (result && result.isSuc) {
                await this.createProject(result.name, result.uri, result.yn.toUpperCase() === "Y");
            }
        });
    }

    public createScriptCmd(scriptType: ScriptTypes): Disposable {
        return commands.registerCommand(`mflow.${scriptType}.create`, async () => {
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
        return commands.registerCommand("mflow.install.script", async () => {
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
        return commands.registerCommand("mflow.show.installed", () => {
            this.getInstalledScript();
        });
    }

    public uninstallScriptCmd(): Disposable {
        return commands.registerCommand("mflow.uninstall.script", async () => {
            const scriptId = await createInputBox("Please enter script id: ", "notification");
            if (!scriptId) return;
            this.uninstallScript(scriptId);
        });
    }

    public remoteScriptCmd(): Disposable {
        return commands.registerCommand("mflow.remote.scripts", async () => {
            const scriptId = await createInputBox("Please enter script id: ", "notification or *");
            if (!scriptId) return;
            this.remoteScript(scriptId);
        });
    }

    public upCmd(): Disposable {
        return commands.registerCommand("mflow.up", () => this.up());
    }

    public runCmd(): Disposable {
        return commands.registerCommand("mflow.run", () => this.run());
    }

    public downCmd(): Disposable {
        return commands.registerCommand("mflow.down", () => this.down());
    }

    public logsCmd(): Disposable {
        return commands.registerCommand("mflow.logs", async () => {
            const scriptId = await createInputBox("Please enter script id: ", "notification or *");
            if (!scriptId) return;
            this.logs(scriptId);
        });
    }

    public buildCmd(): Disposable {
        return commands.registerCommand("mflow.build", async () => {
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
        return commands.registerCommand(isAuto ? "mflow.deploy.auto" : "mflow.deploy", async () => {
            if (!this.verifyRootPath()) return;
            const result = await multiStepInput("Deploy mflow project", MultiStepTypes.DEPLOY, this);
            if (result && result.isSuc) {
                await this.deploy(isAuto, result.type, result.yn.toUpperCase() === "Y", result.scriptType, result.uri);
            }
        });
    }

    public packCmd(): Disposable {
        return commands.registerCommand("mflow.pack", async () => {
            const items = Object.values(PackTypes).map(label => ({ label }));
            await commands.executeCommand("workbench.action.files.save");
            await createQuickPick(items, async selection => {
                if (!selection) return;
                await this.pack(selection);
            });
        });
    }

    public viewWf(): Disposable {
        return commands.registerTextEditorCommand("mflow.view.wf", editor => {
            if (this.wfUri !== editor.document.fileName) return;
            const title = this.wfUri ? path.basename(this.wfUri) : "graph.yml";
            const panel = window.createWebviewPanel("wfGraph", title, ViewColumn.One);
            panel.webview.html = this.buildWfGraphWebView(panel);
        });
    }

    public autoCompleteItems(): Disposable {
        return languages.registerCompletionItemProvider(
            { scheme: "file", language: "yaml" },
            {
                provideCompletionItems: async (document, position) => {
                    await commands.executeCommand("workbench.action.files.save");
                    if (!this.wfUri || !this.wfYaml || !this.rootPath) return;
                    if (document.fileName !== this.wfUri) return [new CompletionItem("")];
                    const item = await autoComplete(
                        document,
                        position,
                        this.rootPath,
                        this.wfYaml,
                        this.wfScript,
                        this.output
                    )
                        .then(function(response: any) {
                            return response;
                        })
                        .catch(function(error: Error) {
                            console.log(error);
                            return [new CompletionItem("")];
                        });
                    return item;
                }
            },
            "."
        );
    }

    public reloadWfYamlbyWfUri(document: TextDocument): Record<string, any> | undefined {
        const lang = document.languageId;
        if (!(this.rootPath && document.uri.scheme === "file" && (lang === "json" || lang === "yaml"))) return;
        if (lang === "json") {
            if (document.fileName !== path.join(this.rootPath, "manifest.json")) return;
            const wfUriNew = getWfUri(this.rootPath);
            this.wfUri = wfUriNew || this.wfUri;
        } else {
            if (!(this.wfUri && document.fileName === this.wfUri)) return;
            const wfYamlNew = getWfYaml(this.wfUri);
            this.wfYaml = wfYamlNew || this.wfYaml;
            if (!wfYamlNew) return;
            const openFile = execCommandCallback(stdout => {
                if (!stdout) return;
                this.wfScript = yaml.safeLoad(stdout.toString());
            });
            child.execFile(`${this.mflowPath}`, ["showscripts"], { cwd: this.rootPath }, openFile);
        }
    }
}
