import { window, Uri, OutputChannel, commands, QuickPickItem, TextDocument, Position } from "vscode";
import child from "child_process";
import path from "path";
import yaml from "js-yaml";
import fs from "fs";
import { activeMflowTerminal, createQuickPick, execCommandCallback } from "./basicInput";
import { getWfUri, getWfYaml, getMFlowPath } from "./path";

/**
 * Package source type.
 */
export enum PackTypes {
    ALL = "The mflow Project",
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
 * mflow Commands
 */
export class CliCommands {
    readonly noRootPathErrorMsg = "Please create or open mflow project first!";
    wfUri: string | undefined;
    wfYaml: any;
    wfScript: any;
    mflowPath: string | undefined;

    constructor(public rootPath: string, public output: OutputChannel) {
        this.mflowPath = getMFlowPath();
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
        child.execFile(`${this.mflowPath}`, ["showscripts"], { cwd: rootPath }, openFile);
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
        const buffer = child.execFileSync(`${this.mflowPath}`, ["showscripts"], { cwd: this.rootPath });
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
        const terminal = activeMflowTerminal();
        commands.forEach(value => terminal.sendText(value));
        terminal.show();
    }

    /**
     * Get mflow version.
     */
    public getVersion(): void {
        this.output.appendLine(`Show version.`);
        this.sendTerminal(`${this.mflowPath} -V`);
    }

    /**
     * Create mflow project.
     * @param name: mflow project name.
     * @param uri: where the project created.
     * @param isGenSample: is generator sample wf template.
     */
    public async createProject(name: string, uri: Uri, isGenSample: boolean): Promise<void> {
        this.output.appendLine(`Create mflow project ${name} in ${uri.fsPath}.`);
        const openFolder = execCommandCallback(() => {
            const workspaceUri: Uri = Uri.parse(uri.fsPath + "/" + name);
            commands.executeCommand("vscode.openFolder", workspaceUri);
        }, this.output);
        const exam = isGenSample ? "--example" : "";
        child.execFile(`${this.mflowPath}`, ["create", "-y", exam, `${name}`], { cwd: uri.fsPath }, openFolder);
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
        child.execFile(`${this.mflowPath}`, [scriptType, "create", `${name}`], { cwd: this.rootPath }, openFile);
    }

    /**
     * Install script id(with version or not).
     * @param scriptId: might be the scriptId/scriptId with version/all.
     */
    public installScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Install script ${scriptId}.`);
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.mflowPath} install ${scriptId}`);
    }

    /**
     * Get installed script list.
     */
    public getInstalledScript(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Show installed script.`);
        this.sendTerminal(`${this.mflowPath} install -l`);
    }

    /**
     * Uninstall script.
     * @param scriptId: script id.
     */
    public uninstallScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Uninstall script ${scriptId}.`);
        this.sendTerminal(`${this.mflowPath} uninstall ${scriptId}`);
    }

    /**
     * Show remote script.
     * @param scriptId: script id.
     */
    public remoteScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Remote script ${scriptId}.`);
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.mflowPath} remote ${scriptId} -l`);
    }

    /**
     * Up the script, router, enviroment containers
     */
    public up(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Up containers.`);
        this.sendTerminal(`${this.mflowPath} up`);
    }

    /**
     * Auto up containers and execute the wf template graph.yml.
     */
    public run(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Run.`);
        this.sendTerminal(`${this.mflowPath} run --auto`);
    }

    /**
     * Down the script, router, enviroment containers.
     */
    public down(): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Down containers.`);
        this.sendTerminal(`${this.mflowPath} down -a`);
    }

    /**
     * View detail logs by scriptId(or all).
     * @param scriptId: the script id or all.
     */
    public logs(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Show logs ${scriptId}.`);
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.mflowPath} logs ${scriptId}`);
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
                    `${this.mflowPath} ${scriptType} build -p ${scriptPath}`,
                    `${this.mflowPath} ${scriptType} push -p ${scriptPath}`
                );
            });
        } else {
            this.sendTerminal(`${this.mflowPath} build`, `${this.mflowPath} push`);
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
                this.sendTerminal(`${this.mflowPath} ${scriptType} pack -p ${scriptPath}`);
            });
        } else {
            const packTartget = itemType.label === PackTypes.ALL ? "-a" : "";
            this.sendTerminal(`${this.mflowPath} pack ${packTartget} --auto-pos`);
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
            this.sendTerminal(`${this.mflowPath} ${scriptType} deploy ${option} `);
        } else {
            option = type === PackTypes.ALL ? "-a " + option : option;
            this.sendTerminal(`${this.mflowPath} deploy ${option}`);
        }
    }

    public buildWfGraphWebView(panel: import("vscode").WebviewPanel): string {
        const result = child.execFileSync(`${this.mflowPath}`, ["graph"], { cwd: this.rootPath });
        let img = path.join(this.rootPath, ".mflow", "graph.gv.png");
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
                <title>Cat Coding</title>
            </head>
            <body>
                <img src="${img}" />
            </body>
            </html>`;
    }

    protected async getTextbyRegex(
        document: TextDocument,
        position: Position,
        matchRegex: { [Symbol.match](string: string): RegExpMatchArray | null },
        endwithPosition = false
    ): Promise<RegExpMatchArray | null | undefined> {
        await commands.executeCommand("workbench.action.files.save");
        const line = endwithPosition
            ? document.lineAt(position).text.substring(0, position.character)
            : document.lineAt(position).text;
        const lineText = line.match(matchRegex);
        if (lineText && lineText.length > 1) {
            return lineText;
        }
    }

    protected async getScriptbyRegex(
        document: TextDocument,
        position: Position,
        matchRegex: { [Symbol.match](string: string): RegExpMatchArray | null },
        endwithPosition = false
    ): Promise<any[] | undefined> {
        const lineText = await this.getTextbyRegex(document, position, matchRegex, endwithPosition);
        if (lineText && lineText.length > 1) {
            const scriptId = document.getText(document.getWordRangeAtPosition(position));
            return this.wfScript.filter((x: { scriptId: any }) => x.scriptId === scriptId);
        }
    }
}
