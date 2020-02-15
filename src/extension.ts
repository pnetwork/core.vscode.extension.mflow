// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { window } from "vscode";
import {
    activeTerminalwithConfig,
    createInputBox,
    createQuickPick,
    getMFlowPath,
    createBrowseFolder
} from "./basicInput";
import { ScriptTypes, PackTypes, MFlowCommand } from "./commands";
import { autoComplete, getWfGraph, getWfUri } from "./autoComplete";

export function activate(c: vscode.ExtensionContext): void {
    const ouputChannel = window.createOutputChannel("mflow ouput");
    let mflowPath = getMFlowPath();
    const rootPath = vscode.workspace.rootPath || "";
    let wfUri: string;
    let wfYaml: any;
    const mflowCmd = new MFlowCommand(mflowPath, rootPath, ouputChannel);

    const showVersionCmd = vscode.commands.registerCommand("mflow.show.version", () => {
        const terminal = activeTerminalwithConfig();
        terminal.sendText(`${mflowPath} -V`);
        terminal.show();
    });
    c.subscriptions.push(showVersionCmd);

    const createProjectCmd = vscode.commands.registerCommand("mflow.create.project", async () => {
        const items = [{ label: "$(file-directory) Browse... (recently used)" }];
        await createQuickPick(items, async () => {
            const folderUri = await createBrowseFolder();
            if (folderUri) {
                console.log("Selected folder: " + folderUri);
                const projectName = await createInputBox("Please enter project name: ");
                if (!projectName) {
                    return;
                }
                mflowCmd.createProject(projectName, folderUri);
            }
        });
    });
    c.subscriptions.push(createProjectCmd);

    const scriptTypeValues = Object.values(ScriptTypes);
    for (const i of scriptTypeValues) {
        const scriptCmd = vscode.commands.registerCommand(`mflow.${i}.create`, async () => {
            const name = await createInputBox(`Please enter ${i} name: `);
            if (!name) {
                return;
            }
            await mflowCmd.createScript(i, name);
        });
        c.subscriptions.push(scriptCmd);
    }

    const installScriptCmd = vscode.commands.registerCommand("mflow.install.script", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification or notification==0.5.0 or *");
        if (!scriptId) {
            return;
        }
        mflowCmd.installScript(scriptId);
    });
    c.subscriptions.push(installScriptCmd);

    const uninstallScriptCmd = vscode.commands.registerCommand("mflow.uninstall.script", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification");
        if (!scriptId) {
            return;
        }
        mflowCmd.uninstallScript(scriptId);
    });
    c.subscriptions.push(uninstallScriptCmd);

    const upCmd = vscode.commands.registerCommand("mflow.up", () => {
        mflowCmd.up();
    });
    c.subscriptions.push(upCmd);

    const runCmd = vscode.commands.registerCommand("mflow.run", () => {
        mflowCmd.run();
    });
    c.subscriptions.push(runCmd);

    const downCmd = vscode.commands.registerCommand("mflow.down", async () => {
        mflowCmd.down();
    });
    c.subscriptions.push(downCmd);

    const logsCmd = vscode.commands.registerCommand("mflow.logs", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification or *");
        if (!scriptId) {
            return;
        }
        mflowCmd.logs(scriptId);
    });
    c.subscriptions.push(logsCmd);

    const packCmd = vscode.commands.registerCommand("mflow.pack", async () => {
        const items = Object.values(PackTypes).map(label => ({ label }));
        await createQuickPick(items, async selection => {
            await mflowCmd.pack(selection);
        });
    });
    c.subscriptions.push(packCmd);

    const deployCmd = vscode.commands.registerCommand("mflow.deploy", async () => {
        const quickPick = window.createQuickPick();
        quickPick.items = Object.values(PackTypes).map(label => ({ label }));

        await createQuickPick(
            Object.values(PackTypes).map(label => ({ label })),
            async selection => {
                await mflowCmd.deploy(selection);
            }
        );
    });
    c.subscriptions.push(deployCmd);

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

    vscode.workspace.onDidChangeConfiguration(() => {
        mflowPath = getMFlowPath();
    });

    c.subscriptions.push(
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
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
