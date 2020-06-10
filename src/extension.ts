import vscode from "vscode";
import { TrekCommand } from "./commands";
import { CONFIG_NAME, getRootPath } from "./path";
import { ScriptTypes } from "./util";
let ouputChannel: vscode.OutputChannel;
let rootPath: string;
let trekCmd: TrekCommand;

export function activate(c: vscode.ExtensionContext): void {
    ouputChannel = vscode.window.createOutputChannel("Trek Ouput");
    rootPath = getRootPath();
    trekCmd = new TrekCommand(rootPath, ouputChannel);
    if (vscode.window.activeTextEditor?.document.fileName === trekCmd.wfUri) {
        vscode.commands.executeCommand("setContext", "isWfYaml", true);
    } else {
        vscode.commands.executeCommand("setContext", "isWfYaml", false);
    }

    const cmdList = [
        trekCmd.showVersionCmd(),
        trekCmd.loginCmd(),
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
        trekCmd.buildBlcksCmd(),
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
        const packCmd = trekCmd.packScriptCmd(i);
        c.subscriptions.push(packCmd);
        const runCmd = trekCmd.runScriptCmd(i);
        c.subscriptions.push(runCmd);
        const deployCmd = trekCmd.deployScriptCmd(true, i);
        c.subscriptions.push(deployCmd);
        const deployAutoCmd = trekCmd.deployScriptCmd(false, i);
        c.subscriptions.push(deployAutoCmd);
    }

    c.subscriptions.concat(cmdList);

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        if (trekCmd.isWfProject && trekCmd.verifyIsEntryJsonOrWfFile(document)) trekCmd.reloadWfYamlbyWfUri(document);
    });
    vscode.workspace.onDidChangeConfiguration(event => {
        if (!event.affectsConfiguration(CONFIG_NAME)) return;
        trekCmd.reloadTrekPath();
        trekCmd.reloadWfScript();
    });
    vscode.window.onDidChangeActiveTextEditor(e => {
        if (!trekCmd.isWfProject) return;
        if (trekCmd.wfUri !== e?.document?.fileName) vscode.commands.executeCommand("setContext", "isWfYaml", false);
        else vscode.commands.executeCommand("setContext", "isWfYaml", true);
    });
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
