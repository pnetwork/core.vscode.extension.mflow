import { window, Uri, OutputChannel, commands, QuickPickItem, TextDocument } from "vscode";
import child from "child_process";
import path from "path";
import yaml from "js-yaml";
import fs from "fs";
import { activeTrekTerminal, createQuickPick, execCommandCallback } from "./basicInput";
import { getWfUri, getWfYaml, getTrekPath } from "./path";

/**
 * Package source type.
 */
export enum PackTypes {
    ALL = "The Trek Project",
    SCRIPT = "Only Script",
    WORKFLOW = "Only Workflow"
}

/**
 * Script type.
 */
export enum ScriptTypes {
    BLCKS = "blcks",
    ANSIBLE = "ansible",
    SHELL = "shell"
}

/**
 * Trek Commands
 */
export class CliCommands {
    readonly noRootPathErrorMsg = "Please create or open trek project first!";
    readonly trekReguireVersion = "1.0.0-beta";
    wfUri: string | undefined;
    wfYaml: any;
    wfScript: any;
    trekPath: string | undefined;

    constructor(public rootPath: string, public output: OutputChannel) {
        this.trekPath = getTrekPath();
        this.rootPath = rootPath;
        this.output = output;

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
        window.showErrorMessage(`Trek cli tool version must >= ${this.trekReguireVersion}.`);
    }

    /**
     * Verify the document is workflow template or not.
     * @param document: The trigger document.
     */
    public verifyIsWftemplate(document: TextDocument): boolean {
        if (this.rootPath && this.wfUri && document.fileName === this.wfUri && this.wfYaml && this.wfScript) {
            return true;
        }
        return false;
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
    private getScriptsFromWfTemplate(): any[] {
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
            const result = this.getScriptsFromWfTemplate();
            if (result) {
                result.forEach(i => items.push({ label: i.scriptId, detail: i.scriptPath, description: i.scriptType }));
            }
        } catch (e) {
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
     */
    public async createScript(scriptType: ScriptTypes, name: string): Promise<void> {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Create ${scriptType} project ${name}.`);
        const openFile = execCommandCallback(() => {
            const paraFile = Uri.parse(path.join(this.rootPath, "src", scriptType, name, `${name}.para`));
            commands.executeCommand("vscode.open", paraFile);
        }, this.output);
        child.execFile(`${this.trekPath}`, [`create${scriptType}`, `${name}`], { cwd: this.rootPath }, openFile);
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
     */
    public run(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Run.`);
        this.sendTerminal(`${this.trekPath} run --auto`);
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
     * @param itemType: Select script type.
     */
    public async buildPush(itemType: QuickPickItem): Promise<void> {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Build and push ${itemType.label}.`);
        if (itemType.label === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItems();
            await createQuickPick(scripts, scriptSelect => {
                if (!scriptSelect) return;
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                this.sendTerminal(
                    `${this.trekPath} ${scriptType} build -p ${scriptPath}`,
                    `${this.trekPath} ${scriptType} push -p ${scriptPath}`
                );
            });
        } else {
            this.sendTerminal(`${this.trekPath} build`, `${this.trekPath} push`);
        }
    }

    /**
     * Pack the project depend on packType.
     * @param itemType: Select script type.
     */
    public async pack(itemType: QuickPickItem): Promise<void> {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Pack ${itemType.label}.`);
        if (itemType.label === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItems();
            await createQuickPick(scripts, scriptSelect => {
                if (!scriptSelect) return;
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                this.sendTerminal(`${this.trekPath} ${scriptType} pack -p ${scriptPath}`);
            });
        } else {
            const packTartget = itemType.label === PackTypes.ALL ? "-a" : "";
            this.sendTerminal(`${this.trekPath} pack ${packTartget} --auto-pos`);
        }
    }

    /**
     * Deploy the wf template and script from pack()
     * @param isAuto: Is auto deploy or only deploy.
     * @param type: Select pack type.
     * @param isOverwrite: Is overwrite marvel script/wf.
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
        option = isAuto ? option + " --autobuildpush --autopack" : option;
        if (type === PackTypes.SCRIPT) {
            option = `-p ${scriptUri?.fsPath} ` + option;
            this.sendTerminal(`${this.trekPath} ${scriptType} deploy ${option} `);
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
