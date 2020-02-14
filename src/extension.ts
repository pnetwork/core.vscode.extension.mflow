// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { window } from "vscode";
import * as child from "child_process";
import {
    createProject,
    activeTerminalwithConfig,
    createInputBox,
    getMFlowPath,
    execCommandCallback,
    PackType
} from "./basicInput";
import * as path from "path";
import { autoComplete, getWfGraph, getWfUri } from "./autoComplete";

export function activate(context: vscode.ExtensionContext): void {
    const ouputChannel = window.createOutputChannel("mflow ouput");
    const mflowPath = getMFlowPath();
    const rootPath = vscode.workspace.rootPath || "";
    const noRootPatgErrorMsg = "Please create or open mflow project first!";
    let wfUri: string;
    let wfYaml: any;

    const showVersionCmd = vscode.commands.registerCommand("mflow.show.version", () => {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} -V`);
        terminal.show();
    });
    context.subscriptions.push(showVersionCmd);

    const createProjectCmd = vscode.commands.registerCommand("mflow.create.project", async () => {
        const quickPick = window.createQuickPick();
        quickPick.items = [{ label: "$(file-directory) Browse... (recently used)" }];
        quickPick.onDidAccept((aaa: any) => {
            console.log(aaa, aaa.length);
            console.log("***");
        });
        quickPick.onDidChangeSelection(selection => {
            if (selection[0]) {
                createProject(ouputChannel);
            }
        });
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    });
    context.subscriptions.push(createProjectCmd);

    const createBlcksCmd = vscode.commands.registerCommand("mflow.blcks.create", async () => {
        const blcksName = await createInputBox("Please enter blcks name: ");
        if (!blcksName) {
            return;
        }
        const openFile = execCommandCallback(ouputChannel, () => {
            const uu = vscode.Uri.parse(path.join(rootPath, "src", "blcks", blcksName, `${blcksName}.para`));
            vscode.commands.executeCommand("vscode.open", uu);
        });
        child.execFile(`${mflowPath}`, ["blcks", "create", `${blcksName}`], { cwd: rootPath }, openFile);
    });
    context.subscriptions.push(createBlcksCmd);

    const createAnsibleCmd = vscode.commands.registerCommand("mflow.ansible.create", async () => {
        const ansibleName = await createInputBox("Please enter ansible name: ");
        if (!ansibleName) {
            return;
        }
        const openFile = execCommandCallback(ouputChannel, () => {
            const uu = vscode.Uri.parse(path.join(rootPath, "src", "ansible", ansibleName, `${ansibleName}.para`));
            vscode.commands.executeCommand("vscode.open", uu);
        });
        child.execFile(`${mflowPath}`, ["ansible", "create", `${ansibleName}`], { cwd: rootPath }, openFile);
    });
    context.subscriptions.push(createAnsibleCmd);

    const createShellCmd = vscode.commands.registerCommand("mflow.shell.create", async () => {
        const shellName = await createInputBox("Please enter shell name: ");
        if (!shellName) {
            return;
        }
        const openFile = execCommandCallback(ouputChannel, () => {
            const uu = vscode.Uri.parse(path.join(rootPath, "src", "shell", shellName, `${shellName}.para`));
            vscode.commands.executeCommand("vscode.open", uu);
        });
        child.execFile(`${mflowPath}`, ["shell", "create", `${shellName}`], { cwd: rootPath }, openFile);
    });
    context.subscriptions.push(createShellCmd);

    const buildbaseCmd = vscode.commands.registerCommand("mflow.build.base", async () => {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} buildbase`);
        terminal.show();
    });
    context.subscriptions.push(buildbaseCmd);

    const installScriptCmd = vscode.commands.registerCommand("mflow.install.script", async () => {
        let scriptId = await createInputBox("Please enter script id: ", "notification or notification==0.5.0 or *");
        if (!scriptId) {
            return;
        }
        scriptId = scriptId === "*" ? "" : scriptId;
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} install ${scriptId}`);
        terminal.show();
    });
    context.subscriptions.push(installScriptCmd);

    const uninstallScriptCmd = vscode.commands.registerCommand("mflow.uninstall.script", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification");
        if (!scriptId) {
            return;
        }
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} uninstall ${scriptId}`);
        terminal.show();
    });
    context.subscriptions.push(uninstallScriptCmd);

    const upScriptCmd = vscode.commands.registerCommand("mflow.up", async () => {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} up`);
        terminal.show();
    });
    context.subscriptions.push(upScriptCmd);

    const runScriptCmd = vscode.commands.registerCommand("mflow.run", async () => {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} run --auto`);
        terminal.show();
    });
    context.subscriptions.push(runScriptCmd);

    const downScriptCmd = vscode.commands.registerCommand("mflow.down", async () => {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} down`);
        terminal.show();
    });
    context.subscriptions.push(downScriptCmd);

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        if (!rootPath) {
            return;
        }
        const wf = getWfGraph(rootPath, document);
        if (wf) {
            wfYaml = wf;
            const wfPath = getWfUri(rootPath);
            if (wfPath) {
                wfUri = wfPath;
            }
        }
    });

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            "yaml",
            {
                async provideCompletionItems(document, position) {
                    await vscode.commands.executeCommand("workbench.action.files.save");
                    const item: [vscode.CompletionItem] = await autoComplete(
                        document,
                        position,
                        rootPath,
                        wfYaml,
                        wfUri
                    )
                        .then(function(response: any) {
                            return response;
                        })
                        .catch(function(error: Error) {
                            console.log(error);
                            return [new vscode.CompletionItem("")];
                        });
                    return item;
                }
            },
            "."
        )
    );

    const logsCmd = vscode.commands.registerCommand("mflow.logs", async () => {
        if (!rootPath) {
            vscode.window.showErrorMessage(noRootPatgErrorMsg);
            return;
        }
        let scriptId = await createInputBox("Please enter script id: ", "notification or *");
        if (!scriptId) {
            return;
        }
        scriptId = scriptId === "*" ? "" : scriptId;
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} logs -v ${scriptId}`);
        terminal.show();
    });
    context.subscriptions.push(logsCmd);

    const packCmd = vscode.commands.registerCommand("mflow.pack", async () => {
        if (!rootPath) {
            vscode.window.showErrorMessage(noRootPatgErrorMsg);
            return;
        }
        const quickPick = window.createQuickPick();
        quickPick.items = Object.values(PackType).map(label => ({ label }));
        quickPick.onDidChangeSelection(selection => {
            if (selection[0]) {
                if (selection[0].label === PackType.SCRIPT) {
                    const scriptQuickPick = window.createQuickPick();
                    scriptQuickPick.items = [{ label: "a" }, { label: "b" }];
                    scriptQuickPick.onDidChangeSelection(scriptSelect => {
                        console.log(scriptSelect[0]);
                    });
                    scriptQuickPick.onDidHide(() => quickPick.dispose());
                    scriptQuickPick.show();
                } else {
                    const terminal = activeTerminalwithConfig();
                    const packTartget = selection[0].label === PackType.ALL ? "--all" : "";
                    terminal.sendText(`${mflowPath} pack ${packTartget}`);
                    terminal.show();
                }
            }
        });
        quickPick.onDidHide(() => quickPick.dispose());
        quickPick.show();
    });
    context.subscriptions.push(packCmd);

    const deployCmd = vscode.commands.registerCommand("mflow.deploy", async () => {
        if (!rootPath) {
            vscode.window.showErrorMessage(noRootPatgErrorMsg);
            return;
        }
        let isOverwrite = await createInputBox("Do you want to overwrite existing script on Marvin ? ", "Y/N");
        if (!isOverwrite) {
            return;
        }
        isOverwrite = isOverwrite.toUpperCase() === "Y" ? "-y" : "";
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} deploy -all ${isOverwrite}`);
        terminal.show();
    });
    context.subscriptions.push(deployCmd);
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
