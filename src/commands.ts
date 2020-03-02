import { window, Uri, OutputChannel, commands, QuickPickItem } from "vscode";
import child from "child_process";
import path from "path";
import yaml from "js-yaml";
import fs from "fs";
import { activeMflowTerminal, createQuickPick, execCommandCallback, createInputBox } from "./basicInput";

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
export class MFlowCommand {
    readonly noRootPathErrorMsg = "Please create or open mflow project first!";
    readonly scriptInstalledConf = "packages.json";
    readonly scriptNameReg = new RegExp("^[a-z0-9]+$");

    constructor(public mflowPath: string, public rootPath: string, public output: OutputChannel) {
        this.mflowPath = mflowPath;
        this.rootPath = rootPath;
        this.output = output;
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
        this.sendTerminal(`${this.mflowPath} -V`);
    }

    /**
     * Create mflow project.
     * @param name: mflow project name.
     * @param path: where the project created.
     */
    public async createProject(name: string, path: string): Promise<void> {
        this.output.appendLine(`Create mflow project ${name} in ${path}.`);
        const openFolder = execCommandCallback(() => {
            const workspaceUri: Uri = Uri.parse(path + "/" + name);
            commands.executeCommand("vscode.openFolder", workspaceUri);
        }, this.output);
        child.execFile(`${this.mflowPath}`, ["create", `${name}`, "-y"], { cwd: path }, openFolder);
    }

    /**
     * Create script project under workspace/src.
     * @param scriptType: might be blcks/ansible/shell.
     * @param name: the script name.
     */
    public async createScript(scriptType: ScriptTypes, name: string): Promise<void> {
        if (!this.verifyRootPath()) return;
        if (!this.scriptNameReg.test(name)) {
            this.output.appendLine(`Script name(${name}) should be number(0-9) or lowercase letter(a-z)!`);
            window.showErrorMessage(`Script name(${name}) should be number(0-9) or lowercase letter(a-z)!`);
            return;
        }
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
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendTerminal(`${this.mflowPath} install ${scriptId}`);
    }

    /**
     * Get installed script list.
     */
    public getInstalledScript(): void {
        this.sendTerminal(`${this.mflowPath} install --list`);
    }

    /**
     * Uninstall script.
     * @param scriptId: script id.
     */
    public uninstallScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.output.appendLine(`Uninstall ${scriptId}.`);
        this.sendTerminal(`${this.mflowPath} uninstall ${scriptId}`);
    }

    /**
     * Up the script, router, enviroment containers
     */
    public up(): void {
        if (!this.verifyRootPath()) return;
        this.sendTerminal(`${this.mflowPath} up`);
    }

    /**
     * Auto up containers and execute the wf template graph.yml.
     */
    public run(): void {
        if (!this.verifyRootPath()) return;
        this.sendTerminal(`${this.mflowPath} run --auto`);
    }

    /**
     * Down the script, router, enviroment containers.
     */
    public down(): void {
        if (!this.verifyRootPath()) return;
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
            this.sendTerminal(`${this.mflowPath} pack ${packTartget}`);
        }
    }

    /**
     * Deploy the wf template and script from pack()
     * @param itemType: Select script type.
     * @param isAuto: is auto deploy or only deploy.
     */
    public async deploy(itemType: QuickPickItem, isAuto: boolean): Promise<void> {
        if (!this.verifyRootPath()) return;
        const overwirteQ = "Do you want to overwrite existing script on Marvin ? ";
        this.output.appendLine(`Deploy ${itemType.label}.`);
        if (itemType.label === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItems();
            await createQuickPick(scripts, async scriptSelect => {
                if (!scriptSelect) return;
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                let isOverwrite = await createInputBox(overwirteQ, "Y/N");
                if (!isOverwrite) return;
                isOverwrite = isOverwrite.toUpperCase() === "Y" ? "-y" : "";
                if (isAuto) {
                    this.sendTerminal(
                        `${this.mflowPath} ${scriptType} deploy ${isOverwrite} -p ${scriptPath} --autobuildpush --autopack`
                    );
                } else {
                    this.sendTerminal(`${this.mflowPath} ${scriptType} deploy ${isOverwrite} -p ${scriptPath}`);
                }
            });
        } else {
            const packtype = itemType.label === PackTypes.ALL ? "-a" : "";
            let isOverwrite = await createInputBox(overwirteQ, "Y/N");
            if (!isOverwrite) return;
            isOverwrite = isOverwrite.toUpperCase() === "Y" ? "-y" : "";
            if (isAuto) {
                this.sendTerminal(`${this.mflowPath} deploy ${packtype} ${isOverwrite} --autobuildpush --autopack`);
            } else {
                this.sendTerminal(`${this.mflowPath} deploy ${packtype} ${isOverwrite}`);
            }
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
}