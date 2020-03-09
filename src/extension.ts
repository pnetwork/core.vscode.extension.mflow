import vscode from "vscode";
import { ScriptTypes } from "./basicCliComands";
import { MflowCommand } from "./commands";
import { getMFlowPath } from "./path";
let ouputChannel: vscode.OutputChannel;
let rootPath: string;
let mflowCmd: MflowCommand;

export function activate(c: vscode.ExtensionContext): void {
    ouputChannel = vscode.window.createOutputChannel("mflow ouput");
    const workspaceFolders = vscode.workspace.workspaceFolders;
    rootPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.path : "";
    mflowCmd = new MflowCommand(rootPath, ouputChannel);

    const cmdList = [
        mflowCmd.showVersionCmd(),
        mflowCmd.createProjectCmd(),
        mflowCmd.showInstalledScriptCmd(),
        mflowCmd.installScriptCmd(),
        mflowCmd.uninstallScriptCmd(),
        mflowCmd.remoteScriptCmd(),
        mflowCmd.upCmd(),
        mflowCmd.runCmd(),
        mflowCmd.downCmd(),
        mflowCmd.logsCmd(),
        mflowCmd.buildCmd(),
        mflowCmd.packCmd(),
        mflowCmd.deployCmd(false),
        mflowCmd.deployCmd(true),
        mflowCmd.viewWf(),
        mflowCmd.autoCompleteItems(),
        mflowCmd.jumptoDefination(),
        mflowCmd.hoverTooltip()
    ];

    const scriptTypeValues = Object.values(ScriptTypes);
    for (const i of scriptTypeValues) {
        const scriptCmd = mflowCmd.createScriptCmd(i);
        c.subscriptions.push(scriptCmd);
    }

    c.subscriptions.concat(cmdList);

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => mflowCmd.reloadWfYamlbyWfUri(document));
    vscode.workspace.onDidChangeConfiguration(() => (mflowCmd.mflowPath = getMFlowPath()));
    vscode.window.onDidChangeActiveTextEditor(e => {
        if (mflowCmd.wfUri !== e?.document?.fileName) vscode.commands.executeCommand("setContext", "isWfYaml", false);
        else vscode.commands.executeCommand("setContext", "isWfYaml", true);
    });
    if (vscode.window.activeTextEditor?.document.fileName === mflowCmd.wfUri) {
        vscode.commands.executeCommand("setContext", "isWfYaml", true);
    } else {
        vscode.commands.executeCommand("setContext", "isWfYaml", false);
    }
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
