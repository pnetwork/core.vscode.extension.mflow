import vscode from "vscode";
import { createInputBox, createQuickPick, createBrowseFolder, execCommandCallback } from "./basicInput";
import { ScriptTypes, PackTypes, MFlowCommand } from "./commands";
import { autoComplete } from "./autoComplete";
import { getWfUri, getWfYaml, getMFlowPath } from "./path";
import child from "child_process";
import yaml from "js-yaml";
import path from "path";

let ouputChannel: vscode.OutputChannel;
let rootPath: string;
let wfUri: string | undefined;
let wfYaml: any;
let mflowCmd: MFlowCommand;
let wfScript: any;
const scriptNameReg = new RegExp("^[a-z0-9]+$");

function showVersionCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.show.version", () => mflowCmd.getVersion());
}

function createProjectCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.create.project", async () => {
        const items = [{ label: "$(file-directory) Browse... (recently used)" }];
        await createQuickPick(items, async () => {
            const folderUri = await createBrowseFolder();
            if (!folderUri) return;
            const projectName = await createInputBox("Please enter project name: ");
            if (!projectName) return;
            const genSample = await createInputBox("Create a sample project? ", "Y/N");
            if (!genSample) return;
            mflowCmd.createProject(projectName, folderUri, genSample.toUpperCase() === "Y");
        });
    });
}

function createScriptCmd(scriptType: ScriptTypes): vscode.Disposable {
    return vscode.commands.registerCommand(`mflow.${scriptType}.create`, async () => {
        const name = await createInputBox(`Please enter ${scriptType} name: `, undefined, text => {
            if (!scriptNameReg.test(text)) return "Script name should be number(0-9) or lowercase letter(a-z).";
        });
        if (!name) return;
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
        if (!scriptId) return;
        mflowCmd.uninstallScript(scriptId);
    });
}

function remoteScriptCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.remote.scripts", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification or *");
        if (!scriptId) return;
        mflowCmd.remoteScript(scriptId);
    });
}

function upCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.up", () => mflowCmd.up());
}

function runCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.run", () => mflowCmd.run());
}

function downCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.down", () => mflowCmd.down());
}

function logsCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.logs", async () => {
        const scriptId = await createInputBox("Please enter script id: ", "notification or *");
        if (!scriptId) return;
        mflowCmd.logs(scriptId);
    });
}

function buildCmd(): vscode.Disposable {
    return vscode.commands.registerCommand("mflow.build", async () => {
        const items = Object.values(PackTypes)
            .filter(x => x !== PackTypes.WORKFLOW)
            .map(label => ({ label }));
        await vscode.commands.executeCommand("workbench.action.files.save");
        await createQuickPick(items, async selection => {
            if (!selection) return;
            await mflowCmd.buildPush(selection);
        });
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

function deployCmd(isAuto: boolean): vscode.Disposable {
    return vscode.commands.registerCommand(isAuto ? "mflow.deploy.auto" : "mflow.deploy", async () => {
        const quickPick = vscode.window.createQuickPick();
        quickPick.items = Object.values(PackTypes).map(label => ({ label }));
        await createQuickPick(
            Object.values(PackTypes).map(label => ({ label })),
            async selection => {
                if (!selection) return;
                await mflowCmd.deploy(selection, isAuto);
            }
        );
    });
}

function viewWf(): vscode.Disposable {
    return vscode.commands.registerTextEditorCommand("mflow.view.wf", editor => {
        if (wfUri !== editor.document.fileName) return;

        const title = wfUri ? path.basename(wfUri) : "graph.yml";
        const panel = vscode.window.createWebviewPanel("wfGraph", title, vscode.ViewColumn.One);
        panel.webview.html = mflowCmd.buildWfGraphWebView(panel);
    });
}

function autoCompleteItems(): vscode.Disposable {
    return vscode.languages.registerCompletionItemProvider(
        { scheme: "file", language: "yaml" },
        {
            async provideCompletionItems(document, position) {
                await vscode.commands.executeCommand("workbench.action.files.save");
                if (!wfUri || !wfYaml || !rootPath) return;
                if (document.fileName !== wfUri) return [new vscode.CompletionItem("")];
                const item = await autoComplete(document, position, rootPath, wfYaml, wfScript, ouputChannel)
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
        if (document.fileName !== path.join(rootPath, "manifest.json")) return;
        const wfUriNew = getWfUri(rootPath);
        wfUri = wfUriNew || wfUri;
    } else {
        if (!(wfUri && document.fileName === wfUri)) return;
        const wfYamlNew = getWfYaml(wfUri);
        wfYaml = wfYamlNew || wfYaml;
        if (!wfYamlNew) return;
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
    const workspaceFolders = vscode.workspace.workspaceFolders;
    rootPath = workspaceFolders && workspaceFolders.length > 0 ? workspaceFolders[0].uri.path : "";
    mflowCmd = new MFlowCommand(mflowPath, rootPath, ouputChannel);

    const cmdList = [
        showVersionCmd(),
        createProjectCmd(),
        showInstalledScriptCmd(),
        installScriptCmd(),
        uninstallScriptCmd(),
        remoteScriptCmd(),
        upCmd(),
        runCmd(),
        downCmd(),
        logsCmd(),
        buildCmd(),
        packCmd(),
        deployCmd(false),
        deployCmd(true),
        viewWf(),
        autoCompleteItems()
    ];

    const scriptTypeValues = Object.values(ScriptTypes);
    for (const i of scriptTypeValues) {
        const scriptCmd = createScriptCmd(i);
        c.subscriptions.push(scriptCmd);
    }

    c.subscriptions.concat(cmdList);

    vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => reloadWfYamlbyWfUri(document, mflowPath));
    vscode.workspace.onDidChangeConfiguration(() => (mflowCmd.mflowPath = getMFlowPath()));
    vscode.window.onDidChangeActiveTextEditor(e => {
        if (wfUri !== e?.document?.fileName) vscode.commands.executeCommand("setContext", "isWfYaml", false);
        else vscode.commands.executeCommand("setContext", "isWfYaml", true);
    });
    initWfYamlAndWfUri(mflowPath);
    if (vscode.window.activeTextEditor?.document.fileName === wfUri) {
        vscode.commands.executeCommand("setContext", "isWfYaml", true);
    } else {
        vscode.commands.executeCommand("setContext", "isWfYaml", false);
    }
}

// this method is called when your extension is deactivated
// export function deactivate (): void { }
