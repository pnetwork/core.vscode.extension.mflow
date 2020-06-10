import { window, Uri, OutputChannel, commands, TextDocument, Disposable } from "vscode";
import child from "child_process";
import path from "path";
import yaml from "js-yaml";
import fs from "fs";
import glob from "glob";
import { activeTrekTerminal, createQuickPick, execCommandCallback } from "./basicInput";
import { getWfUri, getWfYaml, getTrekPath } from "./path";
import {
    ScriptTypes,
    isWorkflowProject,
    isAnsibleProject,
    isBlcksProject,
    isShellProject,
    isTerraformProject
} from "./util";
import { ServerResponse } from "http";

/**
 * Package source type.
 */
export enum PackTypes {
    ALL = "The Trek Project",
    SCRIPT = "Only Script",
    WORKFLOW = "Only Workflow"
}

/**
 * Trek Commands
 */
export class CliCommands {
    readonly noRootPathErrorMsg = "Please create or open trek project first!";
    readonly trekReguireVersion = "1.0.0-beta";
    readonly installScriptFolder = "trek_packages";
    wfUri: string | undefined;
    wfYaml: any;
    wfScript: any;
    trekPath: string | undefined;
    isWfProject: boolean;

    constructor(public rootPath: string, public output: OutputChannel) {
        this.trekPath = getTrekPath();
        this.rootPath = rootPath;
        this.output = output;
        this.isWfProject = isWorkflowProject(this.rootPath);

        this.wfUri = getWfUri(rootPath);
        if (!this.wfUri) return;
        this.wfYaml = getWfYaml(this.wfUri);
        if (!this.wfYaml) return;
        const openFile = execCommandCallback(stdout => {
            if (!stdout) return;
            this.wfScript = yaml.safeLoad(stdout.toString());
        });
        child.execFile(`${this.trekPath}`, ["showscripts"], { cwd: rootPath }, openFile);
    }

    /**
     * Reload wfScript by cli command - showscripts.
     */
    public reloadWfScript(): void {
        const openFile = execCommandCallback(stdout => {
            if (!stdout) return;
            this.wfScript = yaml.safeLoad(stdout.toString());
        });
        child.execFile(`${this.trekPath}`, ["showscripts"], { cwd: this.rootPath }, openFile);
    }

    /**
     * When trek path in setting.json was changed then refresh trekPath.
     */
    public reloadTrekPath(): void {
        this.trekPath = getTrekPath();
    }

    /**
     * The project is match script type or not
     * @param scriptType: the script project type
     */
    public matchScriptProject(scriptType: ScriptTypes): boolean {
        let isMatch = false;
        switch (scriptType) {
            case ScriptTypes.ANSIBLE:
                isMatch = isAnsibleProject(this.rootPath);
                break;
            case ScriptTypes.SHELL:
                isMatch = isShellProject(this.rootPath);
                break;
            case ScriptTypes.BLCKS:
                isMatch = isBlcksProject(this.rootPath);
                break;
            case ScriptTypes.TERRAFORM:
                isMatch = isTerraformProject(this.rootPath);
                break;
        }
        if (!isMatch) {
            window.showErrorMessage(`Not ${scriptType} project: ${this.rootPath}`);
        }
        return isMatch;
    }

    /**
     * Verify the workspece path exist or not.
     */
    public verifyRootPath(): boolean {
        if (!this.rootPath) {
            window.showErrorMessage(this.noRootPathErrorMsg);
            return false;
        }
        return true;
    }

    /**
     * Check Trek version require.
     */
    public checkTrekVersion(): void {
        const result = child.execFileSync(`${this.trekPath}`, ["-V"]);
        const version = result.toString().match(/(\d..*)+/);
        if (version && version.length > 0 && version[0] >= this.trekReguireVersion) {
            return;
        }
        window.showErrorMessage(`Trek CLI tool version must >= ${this.trekReguireVersion}.`);
    }

    /**
     * Verify the document is workflow template or not.
     * @param document: The trigger document.
     */
    public verifyIsWftemplate(document: TextDocument): boolean {
        if (this.rootPath && this.wfUri && document.fileName === this.wfUri) {
            return true;
        }
        return false;
    }

    /**
     * Verify wfYaml and wfScript has value.
     */
    public verifyWfData(): boolean {
        return this.wfYaml && this.wfScript;
    }

    public registerCommand(commandId: string, verifyWfProject: boolean, callback: (...args: any[]) => any): Disposable {
        return commands.registerCommand(commandId, async () => {
            if (verifyWfProject && !this.isWfProject) {
                return;
            }
            callback();
        });
    }

    /**
     * Get scripts from wf template.
     * i.e.[{
     * "scriptId": "callservice",
     * "scriptType": "ansible/blcks/shell",
     * "scriptPath": "User/xxx/blcks.python.wf.callservice/",
     * "scriptSchemaPath": "User/xxx/blcks.python.wf.callservice/callservice.para"
     * }]
     */
    private showScripts(): any[] {
        const buffer = child.execFileSync(`${this.trekPath}`, ["showscripts"], { cwd: this.rootPath });
        let result: any;
        try {
            result = yaml.safeLoad(buffer.toString());
        } catch (e) {
            throw Error("Workflow template yaml load fail!");
        }
        return result;
    }

    /**
     * Get scripts in workspace/src folder
     */
    public getScriptQuickPickItems(): any[] {
        const items: any[] = [];
        try {
            const result = this.showScripts();
            if (result) {
                const installScriptPath = path.join(this.rootPath, this.installScriptFolder);
                result.forEach(i => {
                    if (!i.scriptPath.startsWith(installScriptPath)) {
                        items.push({ label: i.scriptId, detail: i.scriptPath, description: i.scriptType });
                    }
                });
            }
        } catch (e) {
            this.output.appendLine(e);
            window.showErrorMessage("Please check workflow template is in the right format!");
        }
        return items;
    }

    /**
     * Get blcks scripts in workspace/src folder
     */
    public getBlcksQuickPickItems(): any[] {
        const items: any[] = [];
        try {
            const result = this.showScripts();
            if (result) {
                const installScriptPath = path.join(this.rootPath, this.installScriptFolder);
                result.forEach(i => {
                    if (!i.scriptPath.startsWith(installScriptPath) && i.scriptType === "blcks") {
                        items.push({ label: i.scriptId, detail: i.scriptPath, description: i.scriptType });
                    }
                });

                const blcksSrcPath = path.join(this.rootPath, "src", "blcks");

                const files = glob.sync("**/*.para", { cwd: blcksSrcPath });

                files.forEach(file => {
                    const paraPath = path.join(blcksSrcPath, file);
                    const scriptPath = path.dirname(paraPath);
                    if (items.findIndex(i => i.detail === scriptPath) === -1) {
                        const s = getWfYaml(paraPath);
                        items.push({ label: String(s.id), detail: scriptPath, description: "blck" });
                    }
                });
            }
        } catch (e) {
            this.output.appendLine(e);
            window.showErrorMessage("Please check workflow template is in the right format!");
        }
        return items;
    }

    /**
     * Excute commands on terminal view.
     * @param commands: commands.
     */
    private sendTerminal(...commands: string[]): void {
        if (!(commands && commands.length > 0)) throw Error("commands mush has value.");
        const terminal = activeTrekTerminal();
        commands.forEach(value => terminal.sendText(value));
        terminal.show();
    }

    /**
     * Get trek version.
     */
    public getVersion(): void {
        this.output.appendLine(`Show version.`);
        this.sendTerminal(`${this.trekPath} -V`);
    }

    /**
     * Create trek project.
     * @param name: trek project name.
     * @param uri: where the project created.
     * @param isGenSample: is generator sample wf template.
     */
    public async createProject(name: string, uri: Uri, isGenSample: boolean): Promise<void> {
        this.output.appendLine(`Create trek project ${name} in ${uri.fsPath}.`);
        const openFolder = execCommandCallback(() => {
            const workspaceUri: Uri = Uri.parse(uri.fsPath + "/" + name);
            commands.executeCommand("vscode.openFolder", workspaceUri);
        }, this.output);
        const cmd = ["createproject", "-y"];
        if (isGenSample) cmd.push("--example");
        cmd.push(`${name}`);
        child.execFile(`${this.trekPath}`, cmd, { cwd: uri.fsPath }, openFolder);
    }

    /**
     * Create script project under workspace/src.
     * @param scriptType: might be blcks/ansible/shell.
     * @param name: the script name.
     * @param uri: where the project created.
     * @param isOpenNewWorkspace: open script project on the new workspace windows.
     */
    public async createScript(
        scriptType: ScriptTypes,
        name: string,
        uri: Uri,
        isOpenNewWorkspace: boolean,
        isWf: boolean
    ): Promise<void> {
        this.output.appendLine(`Create ${scriptType} project ${name} in ${uri.fsPath}.`);

        const openFile = execCommandCallback(() => {
            let projectPath = uri.fsPath;
            if (this.isWfProject) {
                projectPath = path.join(projectPath, "src", scriptType, name);
            } else {
                projectPath = path.join(projectPath, name);
            }
            if (isOpenNewWorkspace) {
                const workspaceUri: Uri = Uri.parse(projectPath);
                commands.executeCommand("vscode.openFolder", workspaceUri, isWf);
            } else {
                const paraFile = Uri.parse(path.join(projectPath, `${name}.para`));
                commands.executeCommand("vscode.open", paraFile);
            }
        }, this.output);
        child.execFile(`${this.trekPath}`, [`create${scriptType}`, name, "-y"], { cwd: uri.fsPath }, openFile);
    }

    /**
     * Login to marvin.
     * @param name: marin user name.
     * @param password: marin user password.
     * @param uri: marin url.
     */
    public async login(name: string, password: string, uri: Uri): Promise<void> {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Login marvin ${uri}.`);
        this.sendTerminal(`${this.trekPath} loginvs -u ${name} -p ${password} -m ${uri.toString()}`);
    }

    /**
     * Install script id(with version or not).
     * @param scriptId: might be the scriptId/scriptId with version/all.
     */
    public installScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Install script ${scriptId}.`);
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.trekPath} install ${scriptId}`);
    }

    /**
     * Get installed script list.
     */
    public getInstalledScript(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Show installed script.`);
        this.sendTerminal(`${this.trekPath} install -l`);
    }

    /**
     * Uninstall script.
     * @param scriptId: script id.
     */
    public uninstallScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Uninstall script ${scriptId}.`);
        this.sendTerminal(`${this.trekPath} uninstall ${scriptId}`);
    }

    /**
     * Show remote script.
     * @param scriptId: script id.
     */
    public remoteScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Remote script ${scriptId}.`);
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.trekPath} listscripts ${scriptId}`);
    }

    /**
     * Up the script, router, enviroment containers
     */
    public up(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Up containers.`);
        this.sendTerminal(`${this.trekPath} initenv`);
    }

    /**
     * Auto up containers and execute the wf template graph.yml.
     * @param scriptType: The script run command.
     */
    public run(scriptType?: ScriptTypes): void {
        if (!this.verifyRootPath()) return;
        // when on the blcks/ansible/shell project pack
        if (scriptType) {
            this.output.appendLine(`Run ${scriptType}.`);
            this.sendTerminal(`${this.trekPath} run${scriptType}`);
        } else {
            this.output.appendLine(`Run.`);
            this.sendTerminal(`${this.trekPath} run --auto`);
        }
    }

    /**
     * Down the script, router, enviroment containers.
     */
    public down(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Down containers.`);
        this.sendTerminal(`${this.trekPath} shutdownenv -a`);
    }

    /**
     * View detail logs by scriptId(or all).
     * @param scriptId: the script id or all.
     */
    public logs(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Show logs ${scriptId}.`);
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.trekPath} logs ${scriptId}`);
    }

    /**
     * Build and push the images depend on packType.
     * @param packType: Select build/push type.
     * @param scriptType: The script pack command.
     */
    public async buildPush(packType: PackTypes, scriptType?: ScriptTypes): Promise<void> {
        if (!this.verifyRootPath()) return;
        // when on the blcks/ansible/shell project pack
        if (scriptType) {
            this.output.appendLine(`Build and push ${scriptType}.`);
            this.sendTerminal(`${this.trekPath} build${scriptType}`, `${this.trekPath} push${scriptType}`);
            return;
        }
        // The wf project pack
        this.output.appendLine(`Build and push ${packType}.`);
        if (packType === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItems();
            await createQuickPick(scripts, scriptSelect => {
                if (!scriptSelect) return;
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                this.sendTerminal(
                    `${this.trekPath} build${scriptType} -p ${scriptPath}`,
                    `${this.trekPath} push${scriptType} -p ${scriptPath}`
                );
            });
        } else {
            this.sendTerminal(`${this.trekPath} build`, `${this.trekPath} push`);
        }
    }

    /**
     * Pack the project depend on packType.
     * @param packType: Select package type.
     * @param scriptType: The script pack command.
     */
    public async pack(packType: PackTypes, scriptType?: ScriptTypes): Promise<void> {
        if (!this.verifyRootPath()) return;
        // when on the blcks/ansible/shell project pack
        if (scriptType) {
            this.output.appendLine(`Pack ${scriptType}.`);
            this.sendTerminal(`${this.trekPath} pack${scriptType}`);
            return;
        }
        // The wf project pack
        this.output.appendLine(`Pack ${packType}.`);
        if (packType === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItems();
            await createQuickPick(scripts, scriptSelect => {
                if (!scriptSelect) return;
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                this.sendTerminal(`${this.trekPath} pack${scriptType} -p ${scriptPath}`);
            });
        } else {
            const packTartget = packType === PackTypes.ALL ? "-a" : "";
            this.sendTerminal(`${this.trekPath} pack ${packTartget} --auto-pos`);
        }
    }

    /**
     * Deploy the wf template and script from pack()
     * @param isAuto: Is auto deploy or only deploy.
     * @param type: Select pack type.
     * @param isOverwrite: Is overwrite marvin script/wf.
     * @param scriptType: Select script type.
     * @param scriptUri: The script path.
     */
    public async deploy(
        isAuto: boolean,
        type: PackTypes,
        isOverwrite: boolean,
        scriptType?: ScriptTypes,
        scriptUri?: Uri
    ): Promise<void> {
        if (!this.verifyRootPath()) return;
        let option = isOverwrite ? "-y " : "";
        if (type === PackTypes.SCRIPT) {
            if (scriptType === ScriptTypes.BLCKS) {
                option = isAuto ? option + " --autobuildpush --autopack" : option;
            }
            if (scriptUri && scriptUri.fsPath) {
                option = `-p ${scriptUri?.fsPath} ` + option;
            }
            this.sendTerminal(`${this.trekPath} deploy${scriptType} ${option} `);
        } else {
            option = type === PackTypes.ALL ? "-a " + option : option;
            this.sendTerminal(`${this.trekPath} deploy ${option}`);
        }
    }

    public buildWfGraphWebView(panel: import("vscode").WebviewPanel): string {
        const result = child.execFileSync(`${this.trekPath}`, ["graph"], { cwd: this.rootPath });
        let img = path.join(this.rootPath, ".trek", "graph.gv.png");
        if (!fs.existsSync(img)) {
            this.output.appendLine(result.toString());
            window.showErrorMessage(`Workflow template graph generator fail! ${result}`);
            return "";
        }

        this.output.appendLine("Build graph.");
        const diskPath = Uri.file(img);
        img = panel.webview.asWebviewUri(diskPath).toString();
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" >
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Trek Grpah</title>
            </head>
            <body>
                <img src="${img}" />
            </body>
            </html>`;
    }
}
