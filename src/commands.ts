import { window, Uri, OutputChannel, commands, QuickPickItem } from "vscode";
import child from "child_process";
import path from "path";
import yaml from "js-yaml";
import {
    activeTerminalwithConfig,
    createQuickPick,
    getMFlowPath,
    execCommandCallback,
    createInputBox
} from "./basicInput";

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
    public getScriptQuickPickItem(): any[] {
        const items: any[] = [];
        try {
            const result = this.getScriptsFromWfTemplate();
            if (result) {
                for (const i of result) {
                    items.push({ label: i.scriptId, detail: i.scriptPath, description: i.scriptType });
                }
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
    private sendCommandtoTerminal(...commands: string[]): void {
        if (!(commands && commands.length > 0)) throw Error("commands mush has value.");
        const terminal = activeTerminalwithConfig();
        for (const i of commands) {
            terminal.sendText(i);
        }
        terminal.show();
    }

    /**
     * Get mflow version.
     */
    public getVersion(): void {
        this.sendCommandtoTerminal(`${this.mflowPath} -V`);
    }

    /**
     * Create mflow project.
     * @param projectName: mflow project name.
     * @param projectPath: where the project created.
     */
    public async createProject(projectName: string, projectPath: string): Promise<void> {
        const mflowPath = getMFlowPath();
        const openFolder = execCommandCallback(() => {
            const workspaceUri: Uri = Uri.parse(projectPath + "/" + projectName);
            commands.executeCommand("vscode.openFolder", workspaceUri);
        }, this.output);
        child.execFile(`${mflowPath}`, ["create", `${projectName}`, "-y"], { cwd: projectPath }, openFolder);
    }

    /**
     * Create script project under workspace/src.
     * @param scriptType: might be blcks/ansible/shell.
     * @param scriptName: the script name.
     */
    public async createScript(scriptType: ScriptTypes, scriptName: string): Promise<void> {
        if (!this.verifyRootPath()) return;
        const openFile = execCommandCallback(() => {
            const uu = Uri.parse(path.join(this.rootPath, "src", scriptType, scriptName, `${scriptName}.para`));
            commands.executeCommand("vscode.open", uu);
        }, this.output);
        child.execFile(`${this.mflowPath}`, [scriptType, "create", `${scriptName}`], { cwd: this.rootPath }, openFile);
    }

    /**
     * Install script id(with version or not).
     * @param scriptId: might be the scriptId/scriptId with version/all.
     */
    public installScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendCommandtoTerminal(`${this.mflowPath} install ${scriptId}`);
    }

    /**
     * Get installed script list.
     */
    public getInstalledScript(): void {
        this.sendCommandtoTerminal(`${this.mflowPath} install --list`);
    }

    /**
     * Uninstall script.
     * @param scriptId: script id.
     */
    public uninstallScript(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        this.sendCommandtoTerminal(`${this.mflowPath} uninstall ${scriptId}`);
    }

    /**
     * Up the script, router, enviroment containers
     */
    public up(): void {
        if (!this.verifyRootPath()) return;
        this.sendCommandtoTerminal(`${this.mflowPath} up`);
    }

    /**
     * Auto up containers and execute the wf template graph.yml.
     */
    public run(): void {
        if (!this.verifyRootPath()) return;
        this.sendCommandtoTerminal(`${this.mflowPath} run --auto`);
    }

    /**
     * Down the script, router, enviroment containers.
     */
    public down(): void {
        if (!this.verifyRootPath()) return;
        this.sendCommandtoTerminal(`${this.mflowPath} down -a`);
    }

    /**
     * View detail logs by scriptId(or all).
     * @param scriptId: the script id or all.
     */
    public logs(scriptId: string): void {
        if (!this.verifyRootPath()) return;
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendCommandtoTerminal(`${this.mflowPath} logs ${scriptId}`);
    }

    /**
     * Pack the project depend on packType.
     */
    public async pack(packType: QuickPickItem): Promise<void> {
        if (!this.verifyRootPath()) return;
        if (packType.label === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItem();
            await createQuickPick(scripts, scriptSelect => {
                if (!scriptSelect) return;
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                this.sendCommandtoTerminal(`${this.mflowPath} ${scriptType} pack -p ${scriptPath}`);
            });
        } else {
            const packTartget = packType.label === PackTypes.ALL ? "--all" : "";
            this.sendCommandtoTerminal(`${this.mflowPath} pack ${packTartget}`);
        }
    }

    /**
     * Deploy the wf template and script from pack()
     * @param isOverwrite: is overwirte exists scripts/wf templates on marvel
     */
    public async deploy(packType: QuickPickItem): Promise<void> {
        if (!this.verifyRootPath()) return;
        const overwirteQ = "Do you want to overwrite existing script on Marvin ? ";
        if (packType.label === PackTypes.SCRIPT) {
            const scripts = this.getScriptQuickPickItem();
            await createQuickPick(scripts, async scriptSelect => {
                const scriptPath = scriptSelect.detail;
                const scriptType = scriptSelect.description;
                let isOverwrite = await createInputBox(overwirteQ, "Y/N");
                if (!isOverwrite) return;
                isOverwrite = isOverwrite.toUpperCase() === "Y" ? "-y" : "";
                this.sendCommandtoTerminal(`${this.mflowPath} ${scriptType} deploy ${isOverwrite} -p ${scriptPath}`);
            });
        } else {
            const packtype = packType.label === PackTypes.ALL ? "-a" : "";
            let isOverwrite = await createInputBox(overwirteQ, "Y/N");
            if (!isOverwrite) return;
            isOverwrite = isOverwrite.toUpperCase() === "Y" ? "-y" : "";
            this.sendCommandtoTerminal(`${this.mflowPath} deploy ${packtype} ${isOverwrite}`);
        }
    }
}
