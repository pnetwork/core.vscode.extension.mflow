import vscode from "vscode";
import { createInputBox, createQuickPick, getMFlowPath, createBrowseFolder, execCommandCallback } from "./basicInput";
import { ScriptTypes, PackTypes, MFlowCommand } from "./commands";
import { autoComplete } from "./autoComplete";
import { getWfUri, getWfYaml } from "./path";
import child from "child_process";
import yaml from "js-yaml";

let ouputChannel: vscode.OutputChannel;
let rootPath: string;
let wfUri: string | undefined;
let wfYaml: any;
let mflowCmd: MFlowCommand;
let wfScript: any;

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

function showInstalledScriptCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.show.installed", () => {
        mflowCmd.getInstalledScript();
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
        await vscode.commands.executeCommand("workbench.action.files.save");
        await createQuickPick(items, async selection => {
            if (!selection) return;
            await mflowCmd.pack(selection);
        });
    });
}

function deployCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.deploy", async () => {
        const quickPick = vscode.window.createQuickPick();
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
                if (!wfUri || !wfYaml || !rootPath) return;
                const item = await autoComplete(document, position, rootPath, wfYaml, wfUri, wfScript)
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

function reloadWfYamlbyWfUri(document: vscode.TextDocument, mflowPath: string): Record<string, any> | undefined {
    const lang = document.languageId;
    if (!(rootPath && document.uri.scheme === "file" && (lang === "json" || lang === "yaml"))) return;
    if (lang === "json") {
        if (document.fileName !== "manifest.json") return;
        const wfUriNew = getWfUri(rootPath);
        wfUri = wfUriNew || wfUri;
    } else {
        if (!(wfUri && document.fileName === wfUri)) return;
        const wfYamlNew = getWfYaml(wfUri);
        wfYaml = wfYamlNew || wfYaml;
        if (!wfYaml) return;
        const openFile = execCommandCallback(stdout => {
            if (!stdout) return;
            wfScript = yaml.safeLoad(stdout.toString());
        });
        child.execFile(`${mflowPath}`, ["showscripts"], { cwd: rootPath }, openFile);
    }
}

function initWfYamlAndWfUri(mflowPath: string): void {
    wfUri = getWfUri(rootPath);
    if (!wfUri) return;
    wfYaml = getWfYaml(wfUri);
    if (!wfYaml) return;
    const openFile = execCommandCallback(stdout => {
        if (!stdout) return;
        wfScript = yaml.safeLoad(stdout.toString());
    });
    child.execFile(`${mflowPath}`, ["showscripts"], { cwd: rootPath }, openFile);
}

export function activate(c: vscode.ExtensionContext): void {
    ouputChannel = vscode.window.createOutputChannel("mflow ouput");
    const mflowPath = getMFlowPath();
    rootPath = vscode.workspace.rootPath || "";
    mflowCmd = new MFlowCommand(mflowPath, rootPath, ouputChannel);

    const cmdList = [
        showVersionCmd(),
        createProjectCmd(),
        showInstalledScriptCmd(),
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

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => reloadWfYamlbyWfUri(document, mflowPath));
    vscode.workspace.onDidChangeConfiguration(() => {
        mflowCmd.mflowPath = getMFlowPath();
    });
    initWfYamlAndWfUri(mflowPath);
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
