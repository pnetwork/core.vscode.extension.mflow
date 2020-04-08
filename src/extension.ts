import vscode from "vscode";
import { ScriptTypes } from "./basicCliComands";
import { TrekCommand } from "./commands";
import { getTrekPath } from "./path";
let ouputChannel: vscode.OutputChannel;
let rootPath: string;
let trekCmd: TrekCommand;

export function activate(c: vscode.ExtensionContext): void {
    ouputChannel = vscode.window.createOutputChannel("Trek Ouput");
    const workspaceFolders = vscode.workspace.workspaceFolders;
    rootPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.path : "";
    trekCmd = new TrekCommand(rootPath, ouputChannel);
    if (vscode.window.activeTextEditor?.document.fileName === trekCmd.wfUri) {
        vscode.commands.executeCommand("setContext", "isWfYaml", true);
    } else {
        vscode.commands.executeCommand("setContext", "isWfYaml", false);
    }

    const cmdList = [
        trekCmd.showVersionCmd(),
        trekCmd.createProjectCmd(),
        trekCmd.showInstalledScriptCmd(),
        trekCmd.installScriptCmd(),
        trekCmd.uninstallScriptCmd(),
        trekCmd.remoteScriptCmd(),
        trekCmd.upCmd(),
        trekCmd.runCmd(),
        trekCmd.downCmd(),
        trekCmd.logsCmd(),
        trekCmd.buildCmd(),
        trekCmd.packCmd(),
        trekCmd.deployCmd(false),
        trekCmd.deployCmd(true),
        trekCmd.viewWf(),
        trekCmd.autoCompleteItems(),
        trekCmd.jumptoDefination(),
        trekCmd.hoverTooltips()
    ];

    const scriptTypeValues = Object.values(ScriptTypes);
    for (const i of scriptTypeValues) {
        const scriptCmd = trekCmd.createScriptCmd(i);
        c.subscriptions.push(scriptCmd);
    }

    c.subscriptions.concat(cmdList);

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => trekCmd.reloadWfYamlbyWfUri(document));
    vscode.workspace.onDidChangeConfiguration(() => (trekCmd.trekPath = getTrekPath()));
    vscode.window.onDidChangeActiveTextEditor(e => {
        if (trekCmd.wfUri !== e?.document?.fileName) vscode.commands.executeCommand("setContext", "isWfYaml", false);
        else vscode.commands.executeCommand("setContext", "isWfYaml", true);
    });
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
