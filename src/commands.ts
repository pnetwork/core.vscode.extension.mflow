import { window, workspace, Uri, OutputChannel, commands, QuickPickItem } from "vscode";
import * as child from "child_process";
import * as path from "path";
import { activeTerminalwithConfig, createQuickPick, getMFlowPath, execCommandCallback } from "./basicInput";

/**
 * Package source type.
 */
export enum PackTypes {
    ALL = "All",
    SCRIPT = "Script",
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
    noRootPatgErrorMsg = "Please create or open mflow project first!";

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
            window.showErrorMessage(this.noRootPatgErrorMsg);
            return false;
        }
        return true;
    }

    /**
     * Get scripts in workspace/src folder
     */
    private async getSrcScriptPath(): Promise<any[]> {
        const files: any = await workspace.findFiles("src/**/*.para");
        const items: any[] = [];
        for (const i of files) {
            const p = path.parse(i.path);
            items.push({ label: p.name, description: path.dirname(i.path) });
        }
        return items;
    }

    /**
     * Excute commands on terminal view.
     * @param command: command.
     * @param commands: other commands.
     */
    private sendCommandtoTerminal(command: string, ...commands: string[]): void {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(command);
        for (const i of commands) {
            terminal.sendText(i);
        }
        terminal.show();
    }

    /**
     * Create mflow project.
     * @param projectName: mflow project name.
     * @param projectPath: where the project created.
     */
    public async createProject(projectName: string, projectPath: string): Promise<void> {
        const mflowPath = getMFlowPath();
        const openFolder = execCommandCallback(this.output, () => {
            const workspaceUri: Uri = Uri.parse(projectPath + "/" + projectName);
            commands.executeCommand("vscode.openFolder", workspaceUri);
        });
        child.execFile(`${mflowPath}`, ["create", `${projectName}`], { cwd: projectPath }, openFolder);
    }

    /**
     * Create script project under workspace/src.
     * @param scriptType: might be blcks/ansible/shell.
     * @param scriptName: the script name.
     */
    public async createScript(scriptType: ScriptTypes, scriptName: string): Promise<void> {
        if (!this.verifyRootPath()) {
            return;
        }
        const openFile = execCommandCallback(this.output, () => {
            const uu = Uri.parse(path.join(this.rootPath, "src", scriptType, scriptName, `${scriptName}.para`));
            commands.executeCommand("vscode.open", uu);
        });
        child.execFile(`${this.mflowPath}`, [scriptType, "create", `${scriptName}`], { cwd: this.rootPath }, openFile);
    }

    /**
     * Install script id(with version or not).
     * @param scriptId: might be the scriptId/scriptId with version/all.
     */
    public installScript(scriptId: string): void {
        if (!this.verifyRootPath()) {
            return;
        }
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendCommandtoTerminal(`${this.mflowPath} install ${scriptId}`);
    }

    /**
     * Uninstall script.
     * @param scriptId: script id.
     */
    public uninstallScript(scriptId: string): void {
        if (!this.verifyRootPath()) {
            return;
        }
        this.sendCommandtoTerminal(`${this.mflowPath} uninstall ${scriptId}`);
    }

    /**
     * Up the script, router, enviroment containers
     */
    public up(): void {
        if (!this.verifyRootPath()) {
            return;
        }
        this.sendCommandtoTerminal(`${this.mflowPath} up`);
    }

    /**
     * Auto up containers and execute the wf template graph.yml.
     */
    public run(): void {
        if (!this.verifyRootPath()) {
            return;
        }
        this.sendCommandtoTerminal(`${this.mflowPath} run --auto`);
    }

    /**
     * Down the script, router, enviroment containers.
     */
    public down(): void {
        if (!this.verifyRootPath()) {
            return;
        }
        this.sendCommandtoTerminal(`${this.mflowPath} down`);
    }

    /**
     * View detail logs by scriptId(or all).
     * @param scriptId: the script id or all.
     */
    public logs(scriptId: string): void {
        if (!this.verifyRootPath()) {
            return;
        }
        scriptId = scriptId === "*" ? "" : scriptId;
        this.sendCommandtoTerminal(`${this.mflowPath} logs -v ${scriptId}`);
    }

    /**
     * Pack the project depend on packType.
     * @param packType: might be the mflow project/only workflow/script.
     */
    public async pack(packType: QuickPickItem): Promise<void> {
        if (!this.verifyRootPath()) {
            return;
        }
        if (packType.label === PackTypes.SCRIPT) {
            const scripts = await this.getSrcScriptPath();
            await createQuickPick(scripts, scriptSelect => {
                const scriptPath = scriptSelect.description;
                if (!scriptPath) {
                    return;
                }
                const scriptType = Object.values(ScriptTypes).filter((a: string) =>
                    scriptPath.startsWith(path.join(this.rootPath, "src", a))
                );
                this.sendCommandtoTerminal(`cd ${scriptPath}`, `${this.mflowPath} ${scriptType} pack`);
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
    public deploy(isOverwrite: string): void {
        if (!this.verifyRootPath()) {
            return;
        }
        isOverwrite = isOverwrite.toUpperCase() === "Y" ? "-y" : "";
        this.sendCommandtoTerminal(`${this.mflowPath} deploy -all ${isOverwrite}`);
    }
}
