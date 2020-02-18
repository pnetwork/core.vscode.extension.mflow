// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { window } from "vscode";
import { createInputBox, createQuickPick, getMFlowPath, createBrowseFolder } from "./basicInput";
import { ScriptTypes, PackTypes, MFlowCommand } from "./commands";
import { autoComplete, updateWfYamlAndWfUri } from "./autoComplete";

let ouputChannel: vscode.OutputChannel;
let mflowPath: string;
let rootPath: string;
let wfUri: string;
let wfYaml: any;
let mflowCmd: MFlowCommand;

function showVersionCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.show.version", () => {
        mflowCmd.getVersion();
    });
}

function createProjectCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.create.project", async () => {
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
}

function createScriptCmd(scriptType: ScriptTypes): vscode.Disposable {
    return vscode.commands.registerCommand(`mflow.${scriptType}.create`, async () => {
        const name = await createInputBox(`Please enter ${scriptType} name: `);
        if (!name) {
            return;
        }
        await mflowCmd.createScript(scriptType, name);
    });
}

function installScriptCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.install.script", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification or notification==0.5.0 or *");
        if (!scriptId) {
            return;
        }
        mflowCmd.installScript(scriptId);
    });
}
function uninstallScriptCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.uninstall.script", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification");
        if (!scriptId) {
            return;
        }
        mflowCmd.uninstallScript(scriptId);
    });
}

function upCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.up", () => {
        mflowCmd.up();
    });
}

function runCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.run", () => {
        mflowCmd.run();
    });
}

function downCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.down", () => {
        mflowCmd.down();
    });
}

function logsCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.logs", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification or *");
        if (!scriptId) {
            return;
        }
        mflowCmd.logs(scriptId);
    });
}
function packCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.pack", async () => {
        const items = Object.values(PackTypes).map(label => ({ label }));
        await createQuickPick(items, async selection => {
            await mflowCmd.pack(selection);
        });
    });
}

function deployCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.deploy", async () => {
        const quickPick = window.createQuickPick();
        quickPick.items = Object.values(PackTypes).map(label => ({ label }));

        await createQuickPick(
            Object.values(PackTypes).map(label => ({ label })),
            async selection => {
                await mflowCmd.deploy(selection);
            }
        );
    });
}

function autoCompleteItems(): vscode.Disposable {
    return vscode.languages.registerCompletionItemProvider(
        "yaml",
        {
            async provideCompletionItems(document, position) {
                await vscode.commands.executeCommand("workbench.action.files.save");
                const item = await autoComplete(document, position, rootPath, wfYaml, wfUri)
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
    );
}

function changeWf(document: vscode.TextDocument): Record<string, any> | undefined {
    const lang = document.languageId;
    if (!(rootPath && document.uri.scheme === "file" && (lang === "json" || lang === "yaml"))) {
        return;
    }
    if (lang === "json" && document.fileName !== "manifest.json") {
        return;
    }
    const wf = updateWfYamlAndWfUri(rootPath, document);
    if (wf.wfUri && wf.wfYaml) {
        wfYaml = wf.wfYaml;
        wfUri = wf.wfUri;
    }
}

export function activate(c: vscode.ExtensionContext): void {
    ouputChannel = window.createOutputChannel("mflow ouput");
    mflowPath = getMFlowPath();
    rootPath = vscode.workspace.rootPath || "";
    mflowCmd = new MFlowCommand(mflowPath, rootPath, ouputChannel);

    const cmdList = [
        showVersionCmd(),
        createProjectCmd(),
        installScriptCmd(),
        uninstallScriptCmd(),
        upCmd(),
        runCmd(),
        downCmd(),
        logsCmd(),
        packCmd(),
        deployCmd(),
        autoCompleteItems()
    ];

    const scriptTypeValues = Object.values(ScriptTypes);
    for (const i of scriptTypeValues) {
        const scriptCmd = createScriptCmd(i);
        c.subscriptions.push(scriptCmd);
    }

    c.subscriptions.concat(cmdList);

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
        changeWf(document);
    });

    vscode.workspace.onDidChangeConfiguration(() => {
        mflowPath = getMFlowPath();
    });
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
